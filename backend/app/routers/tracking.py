"""Animal-borne telemetry: 742,755 fixes from 3,835 tagged birds.

Two provenances share one table. `source='movebank'` is live API data for 34
curated studies; `source='sagebrush'` is the local geolocator set. The sagebrush
rows carry light-level position bounds, the Movebank rows do not.

Tracks come back as GeoJSON. Where a study's licence requires attribution, the
study it came from travels in the same response, so a client cannot render the
data without also holding the citation.
"""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import distinct, func, select, text

from app.models import Conservation, MovementIndividual, MovementTrack, MovebankStudy
from app.routers.deps import DbDep, PageQuery, PageSizeQuery, not_found, paginated
from app.schemas import (
    IndividualOut,
    Page,
    StudyOut,
    TrackBounds,
    TrackedSpecies,
    TrackResponse,
)
from app.services import resolve, tracks

router = APIRouter(prefix="/tracking", tags=["tracking"])

# Computed on first request, then held: the extent of the tracks cannot change
# until the ingest pipeline runs again.
_BOUNDS: dict | None = None


async def _resolve_tracked(db, name: str) -> str:
    """Find the exact spelling tracking uses for a species.

    Movebank's taxonomy is not always eBird's, so the resolver's answer can miss
    the `canonical_name` stored on the tracks. Folding the handful of taxa we
    actually track catches those.
    """
    resolved = await resolve.resolve_species(db, name)
    if resolved is not None:
        exact = (
            await db.execute(
                select(MovementTrack.id)
                .where(MovementTrack.canonical_name == resolved.scientific_name)
                .limit(1)
            )
        ).scalar_one_or_none()
        if exact is not None:
            return resolved.scientific_name

    folded = resolve.fold(name)
    # 47 taxa on the individuals table, versus a 742,755-row DISTINCT scan if
    # this asked the tracks table for the same list.
    taxa = (
        await db.execute(select(distinct(MovementIndividual.animal_taxon)))
    ).scalars().all()
    match = next((t for t in taxa if t and resolve.fold(t) == folded), None)
    if match:
        return match
    if resolved is not None:
        match = next(
            (t for t in taxa if t and resolve.fold(t) == resolve.fold(resolved.scientific_name)), None
        )
        if match:
            return match
    raise not_found("tracked species", name)


async def _per_study_counts(db) -> tuple[dict, dict]:
    """Points and individuals per study, as two cheap queries.

    Asking `movement_tracks` for `COUNT(DISTINCT individual_local_identifier)`
    alongside `COUNT(*)` forces a temporary B-tree over all 742,755 rows and
    takes ~4.4 s. Split in two it is ~100 ms: the plain count is answered from a
    covering index, and the distinct half is a 3,835-row lookup on the
    individuals table, which is where one row per bird already lives.
    """
    points = dict(
        (await db.execute(
            select(MovementTrack.study_id, func.count()).group_by(MovementTrack.study_id)
        )).all()
    )
    individuals = dict(
        (await db.execute(
            select(MovementIndividual.study_id, func.count()).group_by(MovementIndividual.study_id)
        )).all()
    )
    return points, individuals


# ------------------------------------------------------------------ studies


@router.get("/studies", response_model=list[StudyOut])
async def studies(db: DbDep, species: str | None = None):
    """The Movebank studies behind the telemetry, with what we hold from each.

    Licence and citation are served here because Movebank requires attribution
    for CC BY / CC BY-NC data.
    """
    rows = (await db.execute(select(MovebankStudy).order_by(MovebankStudy.species))).scalars().all()
    if species:
        folded = resolve.fold(species)
        rows = [r for r in rows if folded in (resolve.fold(r.species), resolve.fold(r.name))]

    points, individuals = await _per_study_counts(db)
    return [
        StudyOut(
            study_id=r.study_id,
            name=r.name,
            species=r.species,
            license_type=r.license_type,
            citation=r.citation,
            acknowledgements=r.acknowledgements,
            principal_investigator=r.principal_investigator,
            number_of_individuals=r.number_of_individuals,
            number_of_deployments=r.number_of_deployments,
            sensor_type_ids=r.sensor_type_ids,
            url=r.url,
            individuals_loaded=individuals.get(r.study_id, 0),
            points_loaded=points.get(r.study_id, 0),
        )
        for r in rows
    ]


@router.get("/studies/{study_id}", response_model=StudyOut)
async def study(study_id: str, db: DbDep):
    row = (
        await db.execute(select(MovebankStudy).where(MovebankStudy.study_id == study_id))
    ).scalars().first()
    if row is None:
        raise not_found("study", study_id)
    points, individuals = await _per_study_counts(db)
    return StudyOut(
        study_id=row.study_id,
        name=row.name,
        species=row.species,
        license_type=row.license_type,
        citation=row.citation,
        acknowledgements=row.acknowledgements,
        principal_investigator=row.principal_investigator,
        number_of_individuals=row.number_of_individuals,
        number_of_deployments=row.number_of_deployments,
        sensor_type_ids=row.sensor_type_ids,
        url=row.url,
        individuals_loaded=individuals.get(study_id, 0),
        points_loaded=points.get(study_id, 0),
    )


# ------------------------------------------------------------------ species


@router.get("/species", response_model=list[TrackedSpecies])
async def tracked_species(db: DbDep):
    """Which species have telemetry, and how much — 44 of them.

    Assembled from two cheap queries rather than one expensive join: the counts
    live on the 3,835-row individuals table, the time span on the tracks table
    where `ix_tracks_name_ts` makes MIN/MAX an index lookup at each end.
    """
    spans = {
        sci: (points, first_ts, last_ts)
        for sci, points, first_ts, last_ts in (
            await db.execute(
                select(
                    MovementTrack.canonical_name,
                    func.count(),
                    func.min(MovementTrack.timestamp),
                    func.max(MovementTrack.timestamp),
                )
                .where(MovementTrack.canonical_name.isnot(None))
                .group_by(MovementTrack.canonical_name)
            )
        ).all()
    }

    totals = {
        taxon: (individuals, studies, sources)
        for taxon, individuals, studies, sources in (
            await db.execute(
                select(
                    MovementIndividual.animal_taxon,
                    func.count(),
                    func.count(distinct(MovementIndividual.study_id)),
                    func.group_concat(distinct(MovementIndividual.source)),
                )
                .where(MovementIndividual.animal_taxon.isnot(None))
                .group_by(MovementIndividual.animal_taxon)
            )
        ).all()
    }

    names = sorted(spans)
    common = {}
    if names:
        for sci, name in (
            await db.execute(
                select(Conservation.scientific_name, Conservation.common_name).where(
                    Conservation.scientific_name.in_(names)
                )
            )
        ).all():
            common[sci] = name

    by_points = sorted(spans.items(), key=lambda kv: -kv[1][0])
    items = []
    for sci, (points, first_ts, last_ts) in by_points:
        individuals, studies, sources = totals.get(sci, (0, 0, ""))
        items.append(
            TrackedSpecies(
                scientific_name=sci,
                common_name=common.get(sci),
                studies=studies,
                individuals=individuals,
                points=points,
                first_timestamp=first_ts,
                last_timestamp=last_ts,
                sources=sorted(set((sources or "").split(","))) if sources else [],
            )
        )
    return items


@router.get("/species/{name}/tracks", response_model=TrackResponse)
async def species_tracks(
    name: str,
    db: DbDep,
    resolution: str = Query("monthly", pattern="^(daily|weekly|monthly)$"),
):
    """One polyline per tagged individual of a species.

    Thinned server-side; the response reports the resolution actually used,
    which may be coarser than requested if the point count would be unwieldy.
    """
    scientific = await _resolve_tracked(db, name)
    geojson, points, individuals, requested, used = await tracks.species_tracks(
        db, scientific, resolution
    )
    if not points:
        raise not_found("tracks for species", name)

    studies_rows = await tracks.studies_for_species(db, scientific)
    return TrackResponse(
        species=scientific,
        resolution=used,
        points=points,
        individuals=individuals,
        geojson=geojson,
        studies=[StudyOut.model_validate(s) for s in studies_rows],
    )


# ------------------------------------------------------------------ individuals


@router.get("/individuals", response_model=Page[IndividualOut])
async def individuals(
    db: DbDep,
    species: str | None = None,
    study_id: str | None = None,
    source: str | None = Query(None, pattern="^(movebank|sagebrush)$"),
    page: PageQuery = 1,
    page_size: PageSizeQuery = 50,
):
    conditions = []
    if species:
        conditions.append(MovementIndividual.animal_taxon == await _resolve_tracked(db, species))
    if study_id:
        conditions.append(MovementIndividual.study_id == study_id)
    if source:
        conditions.append(MovementIndividual.source == source)

    total = (
        await db.execute(select(func.count()).select_from(MovementIndividual).where(*conditions))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(MovementIndividual)
            .where(*conditions)
            .order_by(MovementIndividual.animal_taxon, MovementIndividual.animal_id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return paginated(total, page, page_size, [IndividualOut.model_validate(r) for r in rows])


@router.get("/individuals/{individual_id}", response_model=IndividualOut)
async def individual(individual_id: int, db: DbDep):
    row = (
        await db.execute(
            select(MovementIndividual).where(MovementIndividual.id == individual_id)
        )
    ).scalars().first()
    if row is None:
        raise not_found("tagged individual", str(individual_id))
    return IndividualOut.model_validate(row)


@router.get("/individuals/{individual_id}/track", response_model=TrackResponse)
async def individual_track(
    individual_id: int,
    db: DbDep,
    resolution: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
):
    """One bird's full journey, in time order."""
    row = (
        await db.execute(
            select(MovementIndividual).where(MovementIndividual.id == individual_id)
        )
    ).scalars().first()
    if row is None:
        raise not_found("tagged individual", str(individual_id))

    geojson, points, used = await tracks.individual_track(db, individual_id, resolution)
    if not points:
        raise HTTPException(status_code=404, detail=f"Individual {individual_id} has no positions")

    studies_rows = await tracks.studies_for_individual(db, individual_id)
    return TrackResponse(
        species=row.animal_taxon,
        individual=row.animal_id,
        resolution=used,
        points=points,
        individuals=1,
        geojson=geojson,
        studies=[StudyOut.model_validate(s) for s in studies_rows],
    )


@router.get("/bounds", response_model=TrackBounds)
async def bounds(db: DbDep):
    """Extent of every track — the initial view for a world map.

    Computed once and held, because it is a full scan of the tracks table and
    the answer cannot change until the ingest pipeline runs again.
    """
    global _BOUNDS
    if _BOUNDS is None:
        _BOUNDS = await tracks.track_bounds(db)
    return TrackBounds(**(_BOUNDS or {}))
