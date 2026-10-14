"""The API.

    cd backend && ./.venv/Scripts/python.exe -m uvicorn app.main:app --reload

Interactive docs at /docs. Every domain hangs off a router:

    /species     the hub — profile, search, filters, images, summaries
    /occurrence  GBIF points and curves, eBird presence, hotspots, checklists
    /tracking    Movebank studies, tagged individuals, tracks as GeoJSON
    /taxonomy    the eBird backbone
    /phylogeny   the family and species trees
    /geo         the species richness grid
    /classify    photo identification
    /meta        health, row counts, provenance

The database is read-only from here. It is built by `app.ingest.run`, which
clears and reloads each table, so nothing in this service writes to it.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import classify, geo, meta, occurrence, phylogeny, species, taxonomy, tracking
from app.services import classifier

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the ONNX session once at startup.

    Building the graph takes far longer than an inference does, so it is done
    here rather than per request. A failure is logged and swallowed — the API is
    still useful without the classifier.
    """
    try:
        classifier.load()
        logger.info("Classifier loaded: %s", classifier.model_name())
    except Exception as exc:
        logger.error("Classifier failed to load, /classify will be unavailable: %s", exc)
    yield


app = FastAPI(
    title="Bird Atlas API",
    version="1.0.0",
    description=(
        "Species profiles, global occurrence records, animal-borne telemetry, "
        "phylogeny, richness and photo identification — read from a local "
        "SQLite database built by the ingest pipeline."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(species.router)
app.include_router(occurrence.router)
app.include_router(tracking.router)
app.include_router(taxonomy.router)
app.include_router(phylogeny.router)
app.include_router(geo.router)
app.include_router(classify.router)
app.include_router(meta.router)
