"""The species hub — every other domain is reachable from here.

There is no master species table, so a "species" is whatever the resolver finds
(see `services/resolve.py`) and the detail endpoint joins live across the
sources. Blocks simply come back null when a source does not cover the species,
which is expected: traits cover ~11,000 species, the classifier 526, tracking 44.
"""

from functools import lru_cache
from urllib.parse import quote

import requests
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy import distinct, func, select, text

from app.config import settings
from app.models import (
    Conservation,
    GbifMigrationSummary,
    GbifOccurrence,
    MovementIndividual,
    Species,
    SpeciesImage,
    SpeciesSummary,
    Taxonomy,
    Trait,
)
from app.routers.deps import DbDep, PageSizeQuery, PageQuery, SpeciesName, not_found, paginated
from app.schemas import (
    ConservationOut,
    FilterOptions,
    GeoJSONFeatureCollection,
    ImageOut,
    MigrationCurve,
    MovementPresence,
    Page,
    SpeciesAudioList,
    SpeciesAudioOut,
    SpeciesDetail,
    SpeciesListItem,
    SummaryOut,
    TaxonomyOut,
    TraitOut,
)
from app.services import audio, resolve

router = APIRouter(prefix="/species", tags=["species"])

# Wikimedia blocks any client whose User-Agent does not identify it, which is
# what makes a plain redirect useless to a non-browser caller. Same contact
# string the ingest pipeline uses.
IMAGE_UA = {
    "User-Agent": "bird-atlas/0.1 (educational bird data project; contact: bird-atlas@example.org)"
}


@lru_cache(maxsize=256)
def _fetch_remote_image(url: str) -> tuple[bytes, str] | None:
    """Download one upstream image. Cached — a species page is viewed repeatedly."""
    try:
        response = requests.get(url, headers=IMAGE_UA, timeout=20)
        if response.status_code == 200 and response.content:
            return response.content, response.headers.get("Content-Type", "image/jpeg")
    except Exception:
        return None
    return None


# ------------------------------------------------------------------ helpers


async def _one(db, stmt):
    return (await db.execute(stmt)).scalars().first()


async def _tracking_presence(db, scientific_name: str) -> dict:
    """How much telemetry we hold for a species.

    Split across two tables on purpose. `COUNT(DISTINCT
    individual_local_identifier)` over the 742,755-row tracks table needs a
    temporary B-tree; for a species as heavily tracked as the White Stork that
    alone measured 1.4 s. The individuals table already holds exactly one row
    per bird, so asking it separately makes both halves cheap.
    """
    span = (
        await db.execute(
            text(
                "SELECT COUNT(*) AS points, MIN(timestamp) AS first_ts, MAX(timestamp) AS last_ts "
                "  FROM movement_tracks WHERE canonical_name = :sci"
            ),
            {"sci": scientific_name},
        )
    ).mappings().first()
    counts = (
        await db.execute(
            text(
                "SELECT COUNT(*) AS individuals, COUNT(DISTINCT study_id) AS studies "
                "  FROM movement_individuals WHERE animal_taxon = :sci"
            ),
            {"sci": scientific_name},
        )
    ).mappings().first()
    return {
        "points": (span["points"] if span else 0) or 0,
        "first_ts": span["first_ts"] if span else None,
        "last_ts": span["last_ts"] if span else None,
        "individuals": (counts["individuals"] if counts else 0) or 0,
        "studies": (counts["studies"] if counts else 0) or 0,
    }


def _image_url(scientific_name: str) -> str:
    return f"/species/{quote(scientific_name)}/image"


def _image_out(row: SpeciesImage, scientific_name: str) -> ImageOut:
    """Normalise the two image sources into one shape.

    A dataset row has bytes and no URL; a Wikipedia row has URLs and no bytes.
    Either way `image_url` points at this API so the frontend needs no special
    case, and the originals stay attached for attribution.
    """
    return ImageOut(
        source=row.source,
        image_url=_image_url(scientific_name),
        thumbnail_url=row.source_url,
        original_url=row.original_url,
        wikipedia_url=row.wikipedia_url,
        attribution=row.attribution,
        license=row.license,
        width=row.width,
        height=row.height,
        stored_bytes=row.image is not None,
    )


async def _best_image(db, scientific_name: str) -> SpeciesImage | None:
    """Prefer a row whose bytes we hold, so the picture works offline."""
    return await _one(
        db,
        select(SpeciesImage)
        .where(func.lower(SpeciesImage.scientific_name) == scientific_name.lower())
        # `image IS NULL` sorts False (0) first, so byte-backed rows win.
        .order_by(SpeciesImage.image.is_(None), SpeciesImage.id),
    )


async def _annotate(db, rows: list[tuple[Taxonomy, str | None]]) -> list[SpeciesListItem]:
    """Fill in image, IUCN and classifier columns for one page of species.

    Two batched lookups rather than a join: joining the image table would
    multiply rows, because three image classes legitimately share one species
    (ROCK DOVE, FRILL BACK PIGEON and JACOBIN PIGEON are all Columba livia).
    """
    names = [r[0].sci_name for r in rows if r[0].sci_name]
    if not names:
        return []

    images = {}
    for sci, source, thumb, has_bytes in (
        await db.execute(
            select(
                SpeciesImage.scientific_name,
                SpeciesImage.source,
                SpeciesImage.source_url,
                SpeciesImage.image.isnot(None),
            ).where(SpeciesImage.scientific_name.in_(names))
        )
    ).all():
        if sci not in images:
            images[sci] = (source, thumb, has_bytes)

    labels = {}
    for sci, index in (
        await db.execute(
            select(Species.scientific_name, Species.label_index)
            .where(Species.scientific_name.in_(names))
            .order_by(Species.label_index)
        )
    ).all():
        labels.setdefault(sci, index)

    items = []
    for taxonomy_row, rl_category in rows:
        image = images.get(taxonomy_row.sci_name)
        items.append(
            SpeciesListItem(
                scientific_name=taxonomy_row.sci_name,
                common_name=taxonomy_row.primary_com_name,
                family=taxonomy_row.family,
                order_name=taxonomy_row.order_name,
                iucn_category=rl_category,
                # Any image at all is reachable through our own endpoint, which
                # either serves the stored bytes or redirects to the source.
                image_url=_image_url(taxonomy_row.sci_name) if image else None,
                image_thumbnail_url=image[1] if image else None,
                known_to_classifier=taxonomy_row.sci_name in labels,
                label_index=labels.get(taxonomy_row.sci_name),
            )
        )
    return items


def _list_query():
    return (
        select(Taxonomy, Conservation.rl_category)
        .select_from(Taxonomy)
        .outerjoin(Conservation, Conservation.scientific_name == Taxonomy.sci_name)
    )


# ------------------------------------------------------------------ routes

# Literal paths first — FastAPI matches in declaration order, so /search must
# come before /{name} or "search" would be read as a species name.


@router.get("/filters", response_model=FilterOptions)
async def filters(db: DbDep):
    """The vocabulary behind the frontend's filter controls."""
    orders = [
        row[0]
        for row in (
            await db.execute(
                select(distinct(Taxonomy.order_name))
                .where(Taxonomy.category == "species")
                .where(Taxonomy.order_name.isnot(None))
                .order_by(Taxonomy.order_name)
            )
        ).all()
    ]
    families = [
        row[0]
        for row in (
            await db.execute(
                select(distinct(Taxonomy.family))
                .where(Taxonomy.category == "species")
                .where(Taxonomy.family.isnot(None))
                .order_by(Taxonomy.family)
            )
        ).all()
    ]
    iucn = [
        row[0]
        for row in (
            await db.execute(
                select(distinct(Conservation.rl_category))
                .where(Conservation.rl_category.isnot(None))
                .order_by(Conservation.rl_category)
            )
        ).all()
    ]
    total = (
        await db.execute(
            select(func.count()).select_from(Taxonomy).where(Taxonomy.category == "species")
        )
    ).scalar() or 0
    return FilterOptions(
        orders=orders, families=families, iucn_categories=iucn, total_species=total
    )


@router.get("/search", response_model=Page[SpeciesListItem])
async def search(
    db: DbDep,
    q: str = Query(..., min_length=1, description="Part of a common or scientific name"),
    page: PageQuery = 1,
    page_size: PageSizeQuery = 20,
):
    pattern = f"%{q}%"
    condition = Taxonomy.primary_com_name.ilike(pattern) | Taxonomy.sci_name.ilike(pattern)
    stmt = _list_query().where(Taxonomy.category == "species").where(condition)

    total = (
        await db.execute(
            select(func.count())
            .select_from(Taxonomy)
            .where(Taxonomy.category == "species")
            .where(condition)
        )
    ).scalar() or 0

    rows = (await db.execute(stmt.order_by(Taxonomy.order_name, Taxonomy.taxon_order)
                            .offset((page - 1) * page_size).limit(page_size))).all()
    return paginated(total, page, page_size, await _annotate(db, rows))


@router.get("", response_model=Page[SpeciesListItem])
async def list_species(
    db: DbDep,
    page: PageQuery = 1,
    page_size: PageSizeQuery = 50,
    order: str | None = Query(None, description="Exact order, e.g. Passeriformes"),
    family: str | None = Query(None, description="Exact family, e.g. Turdidae"),
    iucn: str | None = Query(None, description="IUCN category, e.g. LC, VU, EN"),
    has_image: bool = Query(False, description="Only species with a picture"),
    has_tracks: bool = Query(False, description="Only species with telemetry"),
    q: str | None = Query(None, description="Free-text name filter"),
    sort: str = Query(
        "taxonomic",
        pattern="^(taxonomic|name|family)$",
        description="taxonomic = the backbone's own order; name = alphabetical",
    ),
):
    stmt = _list_query().where(Taxonomy.category == "species")
    count_stmt = (
        select(func.count())
        .select_from(Taxonomy)
        .outerjoin(Conservation, Conservation.scientific_name == Taxonomy.sci_name)
        .where(Taxonomy.category == "species")
    )

    conditions = []
    if order:
        conditions.append(Taxonomy.order_name == order)
    if family:
        conditions.append(Taxonomy.family == family)
    if iucn:
        conditions.append(Conservation.rl_category == iucn)
    if q:
        conditions.append(
            Taxonomy.primary_com_name.ilike(f"%{q}%") | Taxonomy.sci_name.ilike(f"%{q}%")
        )
    if has_image:
        conditions.append(Taxonomy.sci_name.in_(select(SpeciesImage.scientific_name)))
    if has_tracks:
        # movement_individuals is 3,879 rows; asking the 742,755-row tracks
        # table for DISTINCT names instead costs a full scan for the same list.
        conditions.append(
            Taxonomy.sci_name.in_(select(MovementIndividual.animal_taxon).distinct())
        )

    for condition in conditions:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    total = (await db.execute(count_stmt)).scalar() or 0

    ordering = {
        "name": (Taxonomy.primary_com_name, Taxonomy.sci_name),
        "family": (Taxonomy.family, Taxonomy.taxon_order),
        "taxonomic": (Taxonomy.order_name, Taxonomy.taxon_order),
    }[sort]
    rows = (
        await db.execute(
            stmt.order_by(*ordering)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    return paginated(total, page, page_size, await _annotate(db, rows))


# Xeno-canto serves audio only to callers that present themselves as a browser
# reading their own pages, so the relay carries both a User-Agent and a Referer.
# No bytes are ever written to disk or to the database — the archive stays the
# custodian, which is what its per-recording licences assume.
STREAM_HEADERS = {**IMAGE_UA, "Referer": "https://xeno-canto.org/"}


def _open_audio(url: str):
    return requests.get(url, headers=STREAM_HEADERS, stream=True, timeout=30)


def _relay(upstream, chunk_size: int = 64 * 1024):
    """Pass the archive's bytes through untouched, and always hang up."""
    try:
        for block in upstream.iter_content(chunk_size):
            if block:
                yield block
    finally:
        upstream.close()


@router.get("/audio/{xc_id}/stream")
async def stream_species_audio(xc_id: int, db: DbDep):
    """Relay one Xeno-canto recording to the player.

    Deliberately does **not** advertise `Accept-Ranges`, because the archive
    does not honour them: a Range request measured against `/download` came back
    as a full 200 with the entire body, not a 206. Claiming seek support we
    cannot pass through would leave a player waiting on a range it never gets.
    Playback still works — a browser buffers as it goes — it simply cannot jump
    ahead until enough has arrived.

    The API key is attached here rather than stored, and tried both with and
    without it because the archive does not accept it uniformly.
    """
    row = await audio.get(db, xc_id)
    if row is None:
        raise not_found("recording", str(xc_id))
    if not row.file_url:
        raise HTTPException(status_code=502, detail=f"XC{xc_id} has no download URL")

    candidates = [audio.with_key(row.file_url)]
    if candidates[0] != row.file_url:
        candidates.append(row.file_url)

    upstream = None
    for url in candidates:
        candidate = await run_in_threadpool(_open_audio, url)
        if candidate.status_code == 200:
            upstream = candidate
            break
        candidate.close()

    if upstream is None:
        page = row.page_url or f"https://xeno-canto.org/{xc_id}"
        raise HTTPException(
            status_code=502,
            detail=f"Xeno-canto would not serve XC{xc_id}. The recording is at {page}",
        )

    headers = {"Cache-Control": "public, max-age=86400"}
    if upstream.headers.get("Content-Length"):
        headers["Content-Length"] = upstream.headers["Content-Length"]

    return StreamingResponse(
        _relay(upstream),
        media_type=upstream.headers.get("Content-Type", "audio/mpeg"),
        headers=headers,
    )


@router.get("/{name}", response_model=SpeciesDetail)
async def species_detail(name: SpeciesName, db: DbDep):
    """Everything known about one species, joined live.

    Accepts a scientific or common name in any casing.
    """
    resolved = await resolve.resolve_species(db, name)
    if resolved is None:
        raise not_found("species", name)
    sci = resolved.scientific_name

    taxonomy = await _one(db, select(Taxonomy).where(func.lower(Taxonomy.sci_name) == sci.lower()))
    traits = await _one(db, select(Trait).where(func.lower(Trait.scientific_name) == sci.lower()))
    conservation = await _one(
        db, select(Conservation).where(func.lower(Conservation.scientific_name) == sci.lower())
    )
    image_row = await _best_image(db, sci)
    summary = await _one(
        db, select(SpeciesSummary).where(func.lower(SpeciesSummary.scientific_name) == sci.lower())
    )
    labels = await resolve.label_indices_for(db, sci)

    presence = await _tracking_presence(db, sci)

    if not presence["points"]:
        # Movebank's taxonomy is not always eBird's, so fall back to a folded
        # match against the handful of species that actually have telemetry.
        tracked = (
            await db.execute(text("SELECT DISTINCT animal_taxon FROM movement_individuals"))
        ).scalars().all()
        alternative = next((t for t in tracked if t and resolve.fold(t) == resolve.fold(sci)), None)
        if alternative:
            presence = await _tracking_presence(db, alternative)

    traits_out = None
    if traits:
        traits_out = TraitOut.model_validate(traits)
        traits_out.migration_label = traits.migration_label
        traits_out.habitat_density_label = traits.habitat_density_label

    return SpeciesDetail(
        scientific_name=sci,
        common_name=resolved.common_name or await resolve.common_name_for(db, sci),
        matched_on=resolved.matched_on,
        label_indices=labels,
        taxonomy=TaxonomyOut.model_validate(taxonomy) if taxonomy else None,
        traits=traits_out,
        conservation=ConservationOut.model_validate(conservation) if conservation else None,
        image=_image_out(image_row, sci) if image_row else None,
        summary=SummaryOut.model_validate(summary) if summary else None,
        tracking=MovementPresence(
            studies=presence.get("studies") or 0,
            individuals=presence.get("individuals") or 0,
            points=presence.get("points") or 0,
            first_timestamp=presence.get("first_ts"),
            last_timestamp=presence.get("last_ts"),
        ),
        has_traits=traits is not None,
        has_conservation=conservation is not None,
        has_image=image_row is not None,
        has_summary=summary is not None,
        known_to_classifier=bool(labels),
    )


@router.get("/{name}/image")
async def species_image(
    name: SpeciesName,
    db: DbDep,
    size: str = Query("thumb", pattern="^(thumb|original)$"),
):
    """The species picture, from wherever it lives.

    Byte-backed dataset rows are served straight from SQLite. Wikipedia rows are
    fetched server-side and proxied, rather than redirecting the client at the
    origin: Wikimedia answers 403 to any client whose User-Agent does not
    identify it, which silently breaks <img> tags in anything that is not a
    browser. Proxying means one URL that always works, and the fetch is cached
    both in-process and at the client.
    """
    resolved = await resolve.resolve_species(db, name)
    if resolved is None:
        raise not_found("species", name)

    row = await _best_image(db, resolved.scientific_name)
    if row is None:
        raise not_found("image for species", name)

    headers = {"Cache-Control": "public, max-age=86400"}
    if row.image:
        return Response(
            content=row.image,
            media_type="image/jpeg",
            headers={**headers, "X-Image-Source": "dataset"},
        )

    url = row.source_url if size == "thumb" else (row.original_url or row.source_url)
    if not url:
        raise not_found("image for species", name)

    fetched = await run_in_threadpool(_fetch_remote_image, url)
    if fetched is None:
        raise HTTPException(status_code=502, detail=f"Could not fetch the image from {url}")
    content, content_type = fetched
    return Response(
        content=content,
        media_type=content_type,
        headers={**headers, "X-Image-Source": "wikipedia"},
    )


@router.get("/{name}/audio", response_model=SpeciesAudioList)
async def species_audio(
    name: SpeciesName,
    db: DbDep,
    limit: int = Query(10, ge=1, le=100, description="How many recordings to return"),
):
    """Sound recordings for a species, best-graded first.

    Metadata only. Playback goes through `/species/audio/{xc_id}/stream`, which
    relays the bytes from Xeno-canto, so the frontend never needs to know the
    archive's URLs or headers.

    An empty list is a normal answer rather than an error — a few hundred of the
    world's species have no recording yet, and some groups are thinner than the
    rest, so a page should render "no recording" rather than assume a player.
    """
    resolved = await resolve.resolve_species(db, name)
    if resolved is None:
        raise not_found("species", name)

    rows, cached = await audio.recordings(db, resolved.scientific_name, limit)
    return SpeciesAudioList(
        scientific_name=resolved.scientific_name,
        common_name=resolved.common_name
        or await resolve.common_name_for(db, resolved.scientific_name),
        available=bool(rows),
        cached=cached,
        recordings=[
            # Straight off the ORM row, with only the endpoint derived — that
            # way the field list cannot drift from the model.
            SpeciesAudioOut.model_validate(
                {**row.__dict__, "stream_url": audio.stream_url_for(row.xc_id)}
            )
            for row in rows
        ],
    )


@router.get("/{name}/summary", response_model=SummaryOut)
async def species_summary(name: SpeciesName, db: DbDep):
    """The short Wikipedia description, for the top 250 species only.

    Every other species returns 404 with the reason, because the frontend's
    fallback is a "read on Wikipedia" link rather than stored text.
    """
    resolved = await resolve.resolve_species(db, name)
    if resolved is None:
        raise not_found("species", name)
    row = await _one(
        db,
        select(SpeciesSummary).where(
            func.lower(SpeciesSummary.scientific_name) == resolved.scientific_name.lower()
        ),
    )
    if row is None:
        raise not_found(
            "stored summary for species (only the 250 most-recorded have one)", name
        )
    return SummaryOut.model_validate(row)


@router.get("/{name}/occurrences", response_model=GeoJSONFeatureCollection)
async def species_occurrences(
    name: SpeciesName,
    db: DbDep,
    month: int | None = Query(None, ge=1, le=12),
    limit: int = Query(5000, ge=1, le=20000),
):
    """GBIF records for one species, as GeoJSON, for the map.

    Returns where the bird was *seen*, which is a different question from the
    telemetry in /tracking — that is where tagged individuals actually went.
    """
    resolved = await resolve.resolve_species(db, name)
    if resolved is None:
        raise not_found("species", name)

    stmt = (
        select(GbifOccurrence)
        .where(GbifOccurrence.scientific_name == resolved.scientific_name)
        .where(GbifOccurrence.latitude.isnot(None))
        .where(GbifOccurrence.longitude.isnot(None))
    )
    if month:
        stmt = stmt.where(GbifOccurrence.month == month)
    rows = (await db.execute(stmt.limit(limit))).scalars().all()

    return GeoJSONFeatureCollection(
        features=[
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r.longitude, r.latitude]},
                "properties": {
                    "month": r.month,
                    "year": r.year,
                    "country": r.country,
                    "country_code": r.country_code,
                    "basis_of_record": r.basis_of_record,
                    "common_name": r.common_name,
                },
            }
            for r in rows
        ]
    )


@router.get("/{name}/migration", response_model=MigrationCurve)
async def species_migration(name: SpeciesName, db: DbDep):
    """The species' year as twelve monthly counts — the migration curve."""
    resolved = await resolve.resolve_species(db, name)
    if resolved is None:
        raise not_found("species", name)

    row = await _one(
        db,
        select(GbifMigrationSummary).where(
            (GbifMigrationSummary.scientific_name == resolved.scientific_name)
            | (func.lower(GbifMigrationSummary.common_name) == (resolved.common_name or "").lower())
        ),
    )
    if row is None:
        raise not_found("migration curve for species (only 12 species were sampled)", name)

    return MigrationCurve(
        common_name=row.common_name,
        scientific_name=row.scientific_name,
        gbif_key=row.gbif_key,
        peak_month=row.peak_month,
        georeferenced_records=row.georeferenced_records,
        top_countries=[c.strip() for c in (row.top_countries or "").split(",") if c.strip()],
        months=[getattr(row, f"month_{m:02d}") or 0 for m in range(1, 13)],
    )
