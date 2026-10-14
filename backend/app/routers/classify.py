"""Photo identification.

`POST /classify/identify` takes an uploaded image and returns the most likely
species with confidences, enriched from the database so the client can link
straight to a profile.

The model is a quantized Swin transformer, 98.0% top-1 on the dataset's own
validation split, ~37 ms per image on CPU. Inference is blocking, so it runs in
a threadpool rather than on the event loop.
"""

from urllib.parse import quote

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select

from app.models import Conservation, Species, SpeciesImage
from app.routers.deps import DbDep, page_meta
from app.schemas import ClassifierClass, IdentifyResponse, Prediction
from app.services import classifier

router = APIRouter(prefix="/classify", tags=["classify"])

MAX_UPLOAD_BYTES = 12 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff", "image/gif"}


@router.get("/classes", response_model=list[ClassifierClass])
async def classes(db: DbDep):
    """The 526 classes the model can output, with their resolved names."""
    rows = (await db.execute(select(Species).order_by(Species.label_index))).scalars().all()
    return [
        ClassifierClass(
            label_index=r.label_index,
            common_name=r.name,
            scientific_name=r.scientific_name,
            family=r.family,
        )
        for r in rows
    ]


@router.post("/identify", response_model=IdentifyResponse)
async def identify(
    db: DbDep,
    file: UploadFile = File(..., description="The bird photo"),
    top_k: int = Query(5, ge=1, le=20, description="How many candidates to return"),
):
    """Identify the bird in an uploaded photo.

    Two things this deliberately does not do: it does not reject images the
    model is unsure about (look at the confidences), and it does not know the
    11,000 species outside its 526 classes — a bird it has never seen comes back
    as the nearest class it does know.
    """
    if not classifier.is_loaded():
        raise HTTPException(status_code=503, detail="Classifier is not loaded")
    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type '{file.content_type}'. Send JPEG, PNG or WebP.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image is {len(data) // 1024 // 1024} MB; the limit is {MAX_UPLOAD_BYTES // 1024 // 1024} MB",
        )

    try:
        scored, elapsed_ms, (width, height) = await run_in_threadpool(classifier.predict, data, top_k)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read that image: {exc}")

    indices = [index for index, _ in scored]
    species_rows = (await db.execute(select(Species).where(Species.label_index.in_(indices)))).scalars().all()
    by_index = {r.label_index: r for r in species_rows}

    # One batched lookup so each candidate can show its IUCN status and picture.
    names = [r.scientific_name for r in species_rows if r.scientific_name]
    conservation = {}
    if names:
        for row in (
            await db.execute(
                select(Conservation.scientific_name, Conservation.rl_category).where(
                    Conservation.scientific_name.in_(names)
                )
            )
        ).all():
            conservation[row[0]] = row[1]

    images = set()
    if names:
        images = set(
            (await db.execute(
                select(SpeciesImage.scientific_name).where(SpeciesImage.scientific_name.in_(names))
            )).scalars().all()
        )

    predictions = []
    for index, confidence in scored:
        row = by_index.get(index)
        scientific = row.scientific_name if row else None
        predictions.append(
            Prediction(
                label_index=index,
                common_name=row.name if row else (classifier.label_for(index) or "unknown"),
                confidence=round(confidence, 6),
                scientific_name=scientific,
                family=row.family if row else None,
                iucn_category=conservation.get(scientific),
                profile_url=f"/species/{quote(scientific)}" if scientific else None,
                image_url=f"/species/{quote(scientific)}/image" if scientific in images else None,
            )
        )

    return IdentifyResponse(
        model=classifier.model_name(),
        inference_ms=round(elapsed_ms, 2),
        image_width=width,
        image_height=height,
        predictions=predictions,
    )
