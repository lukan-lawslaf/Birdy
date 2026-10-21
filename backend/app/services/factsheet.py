"""Gather everything the database knows about one species, as plain data.

This is deliberately not an LLM tool-calling loop. Gemma cannot call tools (it
answers with prose *about* calling them), and even where function calling works
it would let a model choose which facts to look up — which is exactly the step
worth keeping deterministic. So the backend fetches the same fields every time,
in a fixed number of indexed queries, and the model only gets to write.

The output serves two readers at once:

    cards/sections  the frontend, for display
    prompt_facts    the model, as the only material it is allowed to use

Because both come from the same rows, the prose can never claim something the
cards contradict.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import quote

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Conservation,
    GbifMigrationSummary,
    Observation,
    SpeciesAudio,
    SpeciesImage,
    SpeciesSummary,
    Taxonomy,
    Trait,
)
from app.services import resolve

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# BirdLife's codes, spelled out. A bare "VU" means nothing to a reader.
IUCN_LABELS = {
    "LC": "Least Concern",
    "NT": "Near Threatened",
    "VU": "Vulnerable",
    "EN": "Endangered",
    "CR": "Critically Endangered",
    "EW": "Extinct in the Wild",
    "EX": "Extinct",
    "DD": "Data Deficient",
    "NR": "Not Recognised",
}

# Which statuses a UI should colour as a warning rather than reassurance.
THREATENED = {"NT", "VU", "EN", "CR", "EW", "EX"}

# The distinct taxon strings in movement_tracks, read once. That table is the
# largest here and the DISTINCT is a full scan — 2.2 s on the first identify
# against 206 ms after. The database is read-only in this service (it is rebuilt
# by app.ingest.run, never written to from the API), so caching is safe for the
# life of the process.
_tracked_names: list[str] | None = None


async def _tracked_name_variants(db: AsyncSession, sci: str) -> set[str]:
    """The movement_tracks spellings that mean `sci`.

    Movebank's taxon strings do not always match eBird's, so compare folded
    rather than trusting an exact match.
    """
    global _tracked_names
    if _tracked_names is None:
        _tracked_names = [
            n
            for n in (
                await db.execute(text("SELECT DISTINCT canonical_name FROM movement_tracks"))
            ).scalars().all()
            if n
        ]
    folded = resolve.fold(sci)
    return {sci.lower()} | {n.lower() for n in _tracked_names if resolve.fold(n) == folded}


@dataclass
class Card:
    """One stat tile. `tone` is a display hint, not data."""

    label: str
    value: str
    hint: str | None = None
    tone: str = "neutral"  # neutral | good | warn | bad


@dataclass
class Section:
    title: str
    body: str


@dataclass
class FactSheet:
    scientific_name: str
    common_name: str | None = None
    matched_on: str | None = None

    family: str | None = None
    order_name: str | None = None
    species_code: str | None = None

    cards: list[Card] = field(default_factory=list)
    sections: list[Section] = field(default_factory=list)

    image_url: str | None = None
    thumbnail_url: str | None = None
    image_attribution: str | None = None
    image_license: str | None = None

    audio_stream_url: str | None = None
    audio_sonogram_url: str | None = None
    audio_note: str | None = None
    audio_count: int = 0

    wikipedia_url: str | None = None
    wikipedia_summary: str | None = None

    iucn_category: str | None = None
    iucn_label: str | None = None
    threatened: bool = False
    population_trend: str | None = None

    mass_g: float | None = None
    wing_length_mm: float | None = None
    habitat: str | None = None
    trophic_niche: str | None = None
    migration_label: str | None = None
    primary_lifestyle: str | None = None
    range_size_km2: float | None = None

    peak_month: str | None = None
    top_countries: str | None = None
    gbif_records: int | None = None
    ebird_observations: int = 0
    tracking_points: int = 0

    links: dict[str, str] = field(default_factory=dict)
    available: dict[str, bool] = field(default_factory=dict)

    prompt_facts: str = ""


async def _one(db: AsyncSession, stmt):
    return (await db.execute(stmt)).scalars().first()


def _number(value: float | int | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value >= 1000:
        return f"{value:,.0f}"
    if isinstance(value, int):
        return f"{value:,}"
    return f"{value:g}"


async def build(db: AsyncSession, name: str, include_audio: bool = True) -> FactSheet | None:
    """Everything known about `name`, or None if no species matches it."""
    resolved = await resolve.resolve_species(db, name)
    if resolved is None:
        return None
    sci = resolved.scientific_name
    sheet = FactSheet(scientific_name=sci, matched_on=resolved.matched_on)

    taxonomy = await _one(db, select(Taxonomy).where(func.lower(Taxonomy.sci_name) == sci.lower()))
    traits = await _one(db, select(Trait).where(func.lower(Trait.scientific_name) == sci.lower()))
    conservation = await _one(
        db, select(Conservation).where(func.lower(Conservation.scientific_name) == sci.lower())
    )
    summary = await _one(
        db, select(SpeciesSummary).where(func.lower(SpeciesSummary.scientific_name) == sci.lower())
    )
    # Prefer a local dataset picture (bytes, always available) over a Wikipedia
    # URL, matching what /species/{name}/image serves.
    image = await _one(
        db,
        select(SpeciesImage)
        .where(func.lower(SpeciesImage.scientific_name) == sci.lower())
        .order_by(SpeciesImage.source.desc()),
    )

    sheet.common_name = (
        resolved.common_name
        or (taxonomy.primary_com_name if taxonomy else None)
        or (conservation.common_name if conservation else None)
        or await resolve.common_name_for(db, sci)
    )
    sheet.family = (taxonomy.family if taxonomy else None) or (traits.family if traits else None)
    sheet.order_name = (taxonomy.order_name if taxonomy else None) or (
        traits.order_name if traits else None
    )
    sheet.species_code = taxonomy.species_code if taxonomy else None

    # ---------------------------------------------------------------- traits
    if traits:
        sheet.mass_g = traits.mass_g
        sheet.wing_length_mm = traits.wing_length_mm
        sheet.habitat = traits.habitat
        sheet.trophic_niche = traits.trophic_niche
        sheet.migration_label = traits.migration_label
        sheet.primary_lifestyle = traits.primary_lifestyle
        sheet.range_size_km2 = traits.range_size_km2

    # ---------------------------------------------------------- conservation
    if conservation:
        code = (conservation.rl_category or "").strip().upper() or None
        sheet.iucn_category = code
        sheet.iucn_label = IUCN_LABELS.get(code, code)
        sheet.threatened = code in THREATENED
        sheet.population_trend = conservation.population_trend

    # --------------------------------------------------------------- summary
    if summary:
        sheet.wikipedia_summary = summary.summary
        sheet.wikipedia_url = summary.wikipedia_url

    # ----------------------------------------------------------------- image
    if image:
        sheet.image_url = f"/species/{quote(sci)}/image"
        sheet.thumbnail_url = f"/species/{quote(sci)}/image?size=thumb"
        sheet.image_attribution = image.attribution
        sheet.image_license = image.license

    # --------------------------------------------------------------- numbers
    migration = await _one(
        db,
        select(GbifMigrationSummary).where(
            func.lower(GbifMigrationSummary.scientific_name) == sci.lower()
        ),
    )
    if migration is None and sheet.common_name:
        migration = await _one(
            db,
            select(GbifMigrationSummary).where(
                func.lower(GbifMigrationSummary.common_name) == sheet.common_name.lower()
            ),
        )
    if migration:
        sheet.gbif_records = migration.georeferenced_records
        sheet.top_countries = migration.top_countries
        if migration.peak_month and 1 <= migration.peak_month <= 12:
            sheet.peak_month = MONTHS[migration.peak_month - 1]

    sheet.ebird_observations = (
        await db.execute(
            select(func.count(Observation.id)).where(
                func.lower(Observation.scientific_name) == sci.lower()
            )
        )
    ).scalar() or 0

    variants = await _tracked_name_variants(db, sci)
    sheet.tracking_points = (
        await db.execute(
            text(
                "SELECT COUNT(*) FROM movement_tracks WHERE LOWER(canonical_name) IN "
                "(" + ",".join(f":v{i}" for i in range(len(variants))) + ")"
            ),
            {f"v{i}": v for i, v in enumerate(variants)},
        )
    ).scalar() or 0

    # ----------------------------------------------------------------- audio
    if include_audio:
        await _attach_audio(db, sheet, sci)

    _build_cards(sheet)
    _build_sections(sheet)
    _build_links(sheet, sci)
    sheet.available = {
        "traits": traits is not None,
        "conservation": conservation is not None,
        "taxonomy": taxonomy is not None,
        "image": image is not None,
        "wikipedia": bool(sheet.wikipedia_summary),
        "audio": sheet.audio_count > 0,
        "migration": migration is not None,
        "tracking": sheet.tracking_points > 0,
        "ebird": sheet.ebird_observations > 0,
    }
    sheet.prompt_facts = _prompt_facts(sheet)
    return sheet


async def _attach_audio(db: AsyncSession, sheet: FactSheet, sci: str) -> None:
    """Pick one recording to offer, from whatever is already cached.

    Only reads the cache — it never calls Xeno-canto. A species whose sound has
    not been fetched yet comes back with no audio and the client can ask
    /species/{name}/audio for it, which is the endpoint that does the fetching.
    Keeping the network out of identify is what holds the response under a
    second for a species that is already warm.
    """
    rows = (
        await db.execute(
            select(SpeciesAudio).where(func.lower(SpeciesAudio.scientific_name) == sci.lower())
        )
    ).scalars().all()
    sheet.audio_count = len(rows)
    if not rows:
        return
    # Compressed first, then the archive's own quality grade: the archive does
    # not transcode, so an "A" grade WAV can be a 14 MB download.
    order = {"mp3": 0, "m4a": 1, "aac": 1, "ogg": 2, "opus": 2, "flac": 3, "wav": 4}
    best = min(
        rows,
        key=lambda r: (
            order.get((r.format or "").casefold(), 5),
            {"a": 0, "b": 1, "c": 2, "d": 3, "e": 4}.get((r.quality or "z").casefold(), 5),
            r.xc_id,
        ),
    )
    sheet.audio_stream_url = f"/species/audio/{best.xc_id}/stream"
    sheet.audio_sonogram_url = best.sonogram_url
    pieces = [p for p in (best.sound_type, best.country, best.length) if p]
    sheet.audio_note = " · ".join(pieces) if pieces else None


def _build_cards(sheet: FactSheet) -> None:
    cards = sheet.cards
    if sheet.iucn_label:
        cards.append(
            Card(
                "Conservation",
                sheet.iucn_label,
                f"IUCN {sheet.iucn_category}" if sheet.iucn_category else None,
                "bad" if sheet.iucn_category in {"EN", "CR", "EW", "EX"}
                else "warn" if sheet.threatened
                else "good",
            )
        )
    if sheet.mass_g is not None:
        cards.append(Card("Mass", f"{sheet.mass_g:g} g", "AVONET mean"))
    if sheet.wing_length_mm is not None:
        cards.append(Card("Wing", f"{sheet.wing_length_mm:g} mm", "AVONET mean"))
    if sheet.migration_label:
        cards.append(Card("Movement", sheet.migration_label, "AVONET"))
    if sheet.habitat:
        cards.append(Card("Habitat", sheet.habitat, "AVONET"))
    if sheet.trophic_niche:
        cards.append(Card("Diet", sheet.trophic_niche, "Trophic niche"))
    if sheet.primary_lifestyle:
        cards.append(Card("Lifestyle", sheet.primary_lifestyle, "AVONET"))
    if sheet.range_size_km2:
        cards.append(Card("Range", f"{sheet.range_size_km2:,.0f} km²", "Breeding range"))
    if sheet.population_trend:
        trend = sheet.population_trend.strip().lower()
        cards.append(
            Card(
                "Population",
                sheet.population_trend,
                "BirdLife",
                "bad" if "decreas" in trend else "good" if "increas" in trend else "neutral",
            )
        )
    if sheet.peak_month:
        cards.append(Card("Peak records", sheet.peak_month, "GBIF, all years"))
    if sheet.gbif_records:
        cards.append(Card("GBIF records", f"{sheet.gbif_records:,}", "Georeferenced"))
    if sheet.tracking_points:
        cards.append(Card("Telemetry", f"{sheet.tracking_points:,} fixes", "Movebank"))
    if sheet.audio_count:
        cards.append(Card("Recordings", f"{sheet.audio_count}", "Xeno-canto"))


def _build_sections(sheet: FactSheet) -> None:
    if sheet.wikipedia_summary:
        sheet.sections.append(Section("About", sheet.wikipedia_summary))
    lineage = " › ".join(p for p in (sheet.order_name, sheet.family) if p)
    if lineage:
        sheet.sections.append(Section("Classification", lineage))
    if sheet.top_countries:
        sheet.sections.append(Section("Most records from", sheet.top_countries))


def _build_links(sheet: FactSheet, sci: str) -> None:
    encoded = quote(sci)
    sheet.links = {
        "profile": f"/species/{encoded}",
        "audio": f"/species/{encoded}/audio",
        "occurrences": f"/species/{encoded}/occurrences",
        "migration": f"/species/{encoded}/migration",
        "summary": f"/species/{encoded}/summary",
    }
    if sheet.wikipedia_url:
        sheet.links["wikipedia"] = sheet.wikipedia_url


def _prompt_facts(sheet: FactSheet) -> str:
    """The facts, flattened for a prompt. Only what the database actually holds.

    Wikipedia's lead paragraph is included but labelled, so the model can draw
    on it for behaviour and appearance without being able to pass off its own
    recollection as one of our measurements.
    """
    lines = [
        f"Scientific name: {sheet.scientific_name}",
        f"Common name: {sheet.common_name or 'unknown'}",
    ]
    for label, value in (
        ("Order", sheet.order_name),
        ("Family", sheet.family),
        ("IUCN Red List", f"{sheet.iucn_label} ({sheet.iucn_category})" if sheet.iucn_label else None),
        ("Population trend", sheet.population_trend),
        ("Body mass", f"{sheet.mass_g:g} g" if sheet.mass_g is not None else None),
        ("Wing length", f"{sheet.wing_length_mm:g} mm" if sheet.wing_length_mm is not None else None),
        ("Habitat", sheet.habitat),
        ("Diet / trophic niche", sheet.trophic_niche),
        ("Lifestyle", sheet.primary_lifestyle),
        ("Migration", sheet.migration_label),
        ("Breeding range size", f"{sheet.range_size_km2:,.0f} km²" if sheet.range_size_km2 else None),
        ("Peak month in GBIF records", sheet.peak_month),
        ("Countries with most records", sheet.top_countries),
        ("Georeferenced GBIF records", _number(sheet.gbif_records)),
        ("Telemetry fixes in our database", _number(sheet.tracking_points) if sheet.tracking_points else None),
        ("Sound recordings catalogued", _number(sheet.audio_count) if sheet.audio_count else None),
    ):
        if value:
            lines.append(f"{label}: {value}")
    if sheet.wikipedia_summary:
        lines.append(f"\nWikipedia lead paragraph:\n{sheet.wikipedia_summary}")
    return "\n".join(lines)
