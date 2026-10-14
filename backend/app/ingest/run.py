"""Run every loader once and print a summary.

    python -m app.ingest.run

Re-runnable: each loader clears its own table first, so running again
rebuilds from scratch rather than duplicating rows.
"""

import time

from sqlalchemy import inspect, text

from app.database import Base, SessionLocal, engine
from app.ingest import ebird_client, images, loaders, movebank_client, summaries

# Columns added after a table already existed in someone's birds.db. create_all
# makes missing tables but never alters an existing one, so these are added by
# hand. Purely additive and nullable, so it is safe on a populated database.
ADDED_COLUMNS = {
    "movement_tracks": {"source": "VARCHAR", "study_id": "VARCHAR"},
    "movement_individuals": {"source": "VARCHAR", "study_id": "VARCHAR"},
    # The richness grid shipped with only a WorldID; location came later.
    "richness_cells": {"latitude": "FLOAT", "longitude": "FLOAT", "country": "VARCHAR"},
    # The archive does not transcode, so the original file's format is the only
    # warning a client gets before pulling a 50 MB WAV.
    "species_audio": {"format": "VARCHAR"},
}

# Indexes added after a table already existed. create_all makes missing tables
# but never touches the indexes on an existing one, and without these the API's
# per-study aggregates scan all 742,755 track rows.
ADDED_INDEXES = [
    ("ix_tracks_study", "movement_tracks", "study_id"),
    ("ix_tracks_source", "movement_tracks", "source"),
    ("ix_individuals_taxon", "movement_individuals", "animal_taxon"),
]


def _ensure_indexes() -> None:
    inspector = inspect(engine)
    with engine.begin() as conn:
        for name, table, column in ADDED_INDEXES:
            if not inspector.has_table(table):
                continue
            existing = {i["name"] for i in inspector.get_indexes(table)}
            if name not in existing:
                print("  creating index %s on %s(%s)" % (name, table, column), flush=True)
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table}({column})"))


def _ensure_columns() -> None:
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in ADDED_COLUMNS.items():
            if not inspector.has_table(table):
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, sqltype in columns.items():
                if name not in existing:
                    print("  adding column %s.%s" % (table, name), flush=True)
                    conn.execute(text("ALTER TABLE %s ADD COLUMN %s %s" % (table, name, sqltype)))


def main() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    _ensure_indexes()
    db = SessionLocal()
    results: list[tuple[str, str]] = []

    def step(label: str, fn) -> None:
        t0 = time.time()
        try:
            out = fn(db)
            detail = out if isinstance(out, str) else "  ".join(str(x) for x in out) if isinstance(out, tuple) else str(out)
            results.append((label, detail))
            print("  %-22s %-14s %.1fs" % (label, detail, time.time() - t0), flush=True)
        except Exception as exc:  # keep going so one bad source does not stop the rest
            db.rollback()
            results.append((label, f"FAILED: {exc}"))
            print("  %-22s FAILED: %s" % (label, exc), flush=True)

    print("Ingesting bird data")
    step("traits (AVONET)", loaders.load_traits)
    step("conservation", loaders.load_conservation)
    step("taxonomy", loaders.load_taxonomy)
    step("observations", loaders.load_observations)
    step("gbif migration", loaders.load_gbif_migration)
    step("movement", loaders.load_movement)
    # must follow `movement`: this only replaces the source='movebank' rows
    step("movebank tracks", movebank_client.load_movebank)
    step("richness", loaders.load_richness)
    step("phylogeny", loaders.load_phylogeny)
    step("cub-200", loaders.load_cub)
    step("species (images)", loaders.load_species)
    step("species photos", images.load_species_images)
    step("ebird api", ebird_client.load_ebird)
    # last: it ranks species by how much eBird/observation data there is
    step("species summaries", summaries.load_species_summaries)

    db.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
