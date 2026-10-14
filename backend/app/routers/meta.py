"""Service metadata: what this API is, what it holds, and where it came from.

`/meta/coverage` is the one worth wiring to a frontend page — it returns the
provenance of every table, so an "about the data" screen can be built without
hard-coding anything.
"""

from pathlib import Path

from fastapi import APIRouter
from sqlalchemy import func, inspect, select, text

from app.config import settings
from app.database import engine
from app.models import (
    Conservation,
    CubClass,
    CubImage,
    EbirdHotspot,
    EbirdMigrationSample,
    GbifMigrationSummary,
    GbifOccurrence,
    MovementIndividual,
    MovementTrack,
    MovebankStudy,
    Observation,
    PhylogenyFamily,
    PhylogenySpecies,
    RichnessCell,
    SamplingEvent,
    Species,
    SpeciesAudio,
    SpeciesImage,
    SpeciesSummary,
    Taxonomy,
    Trait,
)
from app.routers.deps import DbDep
from app.schemas import CoverageResponse, HealthResponse, ServiceInfo, StatsResponse
from app.services import classifier

router = APIRouter(tags=["meta"])

# One entry per table: what it holds, where it came from, and anything a client
# should know before drawing conclusions from it.
TABLE_INFO: list[tuple[str, object, str, str, str, str | None]] = [
    ("traits", Trait, "AVONET traits", "Morphology, ecology and range per species", "AVONET (Zenodo 16586228)", "CC BY 4.0"),
    ("conservation", Conservation, "Conservation status", "IUCN category, population and range", "BirdLife International", None),
    ("taxonomy", Taxonomy, "eBird backbone", "The name authority every join uses", "eBird Taxonomy v2021", None),
    ("species", Species, "Classifier classes", "The 526 class slots of the image dataset", "bird-525 image dataset", None),
    ("observations", Observation, "eBird checklists", "One Alabama county, March 2025", "eBird Basic Dataset sample", None),
    ("sampling_events", SamplingEvent, "eBird effort", "Companion effort file for the checklists", "eBird Basic Dataset sample", None),
    ("gbif_occurrences", GbifOccurrence, "GBIF records", "Where species were seen, balanced across the year", "GBIF", "CC BY 4.0 / CC0 per record"),
    ("gbif_migration_summary", GbifMigrationSummary, "Migration curves", "Monthly totals per species — the abundance view", "GBIF", None),
    ("ebird_migration_samples", EbirdMigrationSample, "eBird presence", "Presence per region-month; counts are always 1", "eBird API", None),
    ("ebird_hotspots", EbirdHotspot, "Birding hotspots", "Known locations per sampled region", "eBird API", None),
    ("movement_individuals", MovementIndividual, "Tagged birds", "One row per tagged individual", "Movebank / Sagebrush 33-1299", "Per study"),
    ("movement_tracks", MovementTrack, "Telemetry fixes", "Daily-reduced GPS/Argos positions", "Movebank direct-read / Sagebrush", "Per study"),
    ("movebank_studies", MovebankStudy, "Study metadata", "Licence, citation and PI per study", "Movebank", "Per study"),
    ("species_summaries", SpeciesSummary, "Species blurbs", "Short Wikipedia descriptions, top 250 only", "Wikipedia REST API", "CC BY-SA"),
    ("species_images", SpeciesImage, "Species pictures", "525 stored as bytes, the rest as URLs", "bird-525 dataset / Wikipedia", None),
    ("species_audio", SpeciesAudio, "Bird sound", "Xeno-canto catalogue entries; audio streams from the archive", "Xeno-canto", "Per recording"),
    ("phylogeny_families", PhylogenyFamily, "Family tree", "483 nodes of the BirdLife phylogeny", "AVONET (BirdLife)", "CC BY 4.0"),
    ("phylogeny_species", PhylogenySpecies, "Species tree", "6,670 tips of the Hackett Stage-1 tree", "AVONET (Hackett)", "CC BY 4.0"),
    ("richness_cells", RichnessCell, "Richness grid", "Species richness per equal-area cell", "AVONET spatial data", "CC BY 4.0"),
    ("cub_classes", CubClass, "CUB classes", "The 200 CUB-200-2011 categories", "CUB-200-2011", "Research use"),
    ("cub_images", CubImage, "CUB annotations", "Bounding boxes and splits for 11,788 images", "CUB-200-2011", "Research use"),
]

COUNTABLE = [info for info in TABLE_INFO if info[0] not in {"species_images"}]


@router.get("/stats", response_model=StatsResponse)
async def stats(db: DbDep):
    """Row counts per table and the size of the file on disk."""
    counts = []
    total = 0
    for table, model, label, description, source, license in TABLE_INFO:
        try:
            if table == "species_images":
                # 525 rows hold JPEG bytes; a plain COUNT(*) would be fast but
                # the split is the interesting part, so report it explicitly.
                rows = (
                    await db.execute(
                        text(
                            "SELECT COUNT(*), SUM(CASE WHEN image IS NOT NULL THEN 1 ELSE 0 END) "
                            "  FROM species_images"
                        )
                    )
                ).first()
                count = rows[0] or 0
                description = f"{rows[1] or 0} with stored bytes, {count - (rows[1] or 0)} URL-only"
            else:
                count = (await db.execute(select(func.count()).select_from(model))).scalar() or 0
        except Exception:
            continue
        total += count
        counts.append(
            {
                "table": table,
                "rows": count,
                "label": label,
                "description": description,
                "source": source,
                "license": license,
            }
        )

    db_path = Path(engine.url.database) if engine.url.database else None
    size_mb = round(db_path.stat().st_size / 1024 / 1024, 1) if db_path and db_path.exists() else 0.0

    return {
        "tables": len(counts),
        "total_rows": total,
        "db_size_mb": size_mb,
        "counts": sorted(counts, key=lambda c: -c["rows"]),
    }


@router.get("/coverage", response_model=CoverageResponse)
async def coverage():
    """Provenance for every table — the frontend's "about the data" page."""
    return {
        "tables": [
            {
                "table": table,
                "label": label,
                "description": description,
                "source": source,
                "license": license,
            }
            for table, _, label, description, source, license in TABLE_INFO
        ],
        "notes": [
            "eBird presence samples record whether a species was reported, not how many — "
            "the historic endpoint returns at most one record per species per day, so "
            "observation_count is always 1. Use the GBIF curves for abundance.",
            "Tracks are daily-reduced (EURING_01): one position per individual per day.",
            "Species summaries exist for the 250 most-recorded species only; every other "
            "species still has a Wikipedia link.",
            "The richness grid carries a location for all 18,421 cells: the source table has "
            "only a cell id and counts, so the cell centre is parsed from the companion "
            "Behrmann shapefile and the country from the cell-to-country table.",
            "The richness grid tiers into countries by mean richness per cell, not by total "
            "species — which is why small equatorial countries rank above large temperate ones.",
            "The classifier knows 526 classes. A bird outside them is reported as the "
            "nearest class it does know.",
            "Two of the 526 image classes are corrupt in the source dataset and are "
            "deliberately left unmatched: LOONEY BIRDS (photographs of people) and "
            "CRESTED NUTHATCH (a mix of two nuthatch species).",
        ],
    }


@router.get("/health", response_model=HealthResponse)
async def health(db: DbDep):
    """Liveness — and it actually asks the database rather than reporting a path.

    An empty database is reported as degraded, not healthy: a missing file is
    silently created by SQLite, so "can connect" alone would not notice a
    project that had lost its data.
    """
    tables = None
    try:
        tables = (
            await db.execute(text("SELECT COUNT(*) FROM sqlite_master WHERE type='table'"))
        ).scalar() or 0
    except Exception:
        tables = None

    db_path = Path(engine.url.database) if engine.url.database else None
    model = classifier.model_name()
    return HealthResponse(
        status="ok" if tables else "degraded",
        database=db_path.name if db_path else None,
        database_ok=bool(tables),
        model_loaded=classifier.is_loaded(),
        classifier=Path(model).name if model else None,
        tables=tables,
    )


@router.get("/", response_model=ServiceInfo)
async def root():
    return {
        "status": "ok",
        "service": "bird-atlas-api",
        "docs": "/docs",
        "domains": [
            "/species",
            "/occurrence",
            "/tracking",
            "/taxonomy",
            "/phylogeny",
            "/geo",
            "/classify",
            "/meta",
        ],
    }
