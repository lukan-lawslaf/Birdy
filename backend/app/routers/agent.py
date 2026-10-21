"""The agent: a photo in, a written answer out.

    POST /agent/identify       upload a bird photo, get the species and a summary
    POST /agent/ask            ask a question about one species
    GET  /agent/species/{name} the same summary without a photo
    GET  /agent/status         what the agent can do right now

`/classify/identify` is still there and still the right call for a raw ranking
of the classifier's 526 classes. This router is the layer above it: it decides
which candidate to trust, searches the database for that species, and has a
model write the paragraph. Everything it returns is display-ready — stat cards
with colour hints, prose, a picture, a playable recording and the links to the
deeper endpoints.
"""

from urllib.parse import quote

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.config import settings
from app.routers.classify import ALLOWED_TYPES, MAX_UPLOAD_BYTES
from app.routers.deps import DbDep, SpeciesName, not_found
from app.schemas import (
    AgentAskResponse,
    AgentCandidate,
    AgentStatus,
    FactSection,
    IdentifyAgentResponse,
    SpeciesFacts,
    SpeciesMedia,
    StatCard,
    VisionVerdict,
)
from app.services import agent, classifier, factsheet, llm
from app.services.factsheet import FactSheet

router = APIRouter(prefix="/agent", tags=["agent"])


class AskRequest(BaseModel):
    """A question about one species.

    Request bodies live here rather than in schemas.py, which by its own
    docstring holds only what clients receive.
    """

    name: str = Field(description="Scientific or common name, any casing")
    question: str = Field(min_length=3, max_length=500, description="What to ask about it")


def _facts_out(sheet: FactSheet) -> SpeciesFacts:
    """Dataclass to response model. Field names match, so most of it is direct."""
    return SpeciesFacts(
        scientific_name=sheet.scientific_name,
        common_name=sheet.common_name,
        family=sheet.family,
        order_name=sheet.order_name,
        species_code=sheet.species_code,
        matched_on=sheet.matched_on,
        iucn_category=sheet.iucn_category,
        iucn_label=sheet.iucn_label,
        threatened=sheet.threatened,
        population_trend=sheet.population_trend,
        mass_g=sheet.mass_g,
        wing_length_mm=sheet.wing_length_mm,
        habitat=sheet.habitat,
        trophic_niche=sheet.trophic_niche,
        migration_label=sheet.migration_label,
        primary_lifestyle=sheet.primary_lifestyle,
        range_size_km2=sheet.range_size_km2,
        peak_month=sheet.peak_month,
        top_countries=sheet.top_countries,
        gbif_records=sheet.gbif_records,
        ebird_observations=sheet.ebird_observations,
        tracking_points=sheet.tracking_points,
        cards=[StatCard(label=c.label, value=c.value, hint=c.hint, tone=c.tone) for c in sheet.cards],
        sections=[FactSection(title=s.title, body=s.body) for s in sheet.sections],
        media=SpeciesMedia(
            image_url=sheet.image_url,
            thumbnail_url=sheet.thumbnail_url,
            image_attribution=sheet.image_attribution,
            image_license=sheet.image_license,
            audio_stream_url=sheet.audio_stream_url,
            audio_sonogram_url=sheet.audio_sonogram_url,
            audio_note=sheet.audio_note,
            audio_count=sheet.audio_count,
        ),
        links=sheet.links,
        available=sheet.available,
    )


@router.get("/status", response_model=AgentStatus)
async def status():
    """Whether the agent is usable, and which models it would reach for.

    Makes no API call, so it is safe to poll — it reports configuration, not
    live quota. A model that is configured can still refuse at request time,
    which is why the summary falls back to a template rather than failing.
    """
    state = llm.status()
    return AgentStatus(
        enabled=state["enabled"],
        classifier_loaded=classifier.is_loaded(),
        classifier_model=classifier.model_name() or None,
        text_models=state["text_models"],
        vision_model=state["vision_model"],
        vision_enabled=state["vision_enabled"],
        vision_threshold=settings.agent_vision_threshold,
        google_key=state["google_key"],
        groq_key=state["groq_key"],
    )


@router.post("/identify", response_model=IdentifyAgentResponse)
async def identify(
    db: DbDep,
    file: UploadFile = File(..., description="A photo of a bird, from upload or camera"),
    top_k: int = Query(5, ge=1, le=20, description="How many candidates to return"),
    verify: str = Query(
        "auto",
        pattern="^(auto|always|never)$",
        description=(
            "When to ask a vision model for a second opinion. auto: only when the "
            "classifier's top-1 falls below the confidence threshold. always: every "
            "upload, which costs one API call each time. never: classifier alone."
        ),
    ),
    include_audio: bool = Query(True, description="Offer a cached recording if one exists"),
):
    """Identify the bird in a photo and describe it from the database.

    The honest caveats, all surfaced in the response rather than hidden: the
    classifier knows 526 species and answers with the nearest of those even for
    a bird it has never seen, so `uncertain` and `warnings` matter as much as
    `common_name`. A photo with no bird in it still gets an answer unless the
    vision cross-check runs and says otherwise, which is what `is_bird` reports.
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
            detail=(
                f"Image is {len(data) // 1024 // 1024} MB; "
                f"the limit is {MAX_UPLOAD_BYTES // 1024 // 1024} MB"
            ),
        )

    try:
        answer = await agent.identify(
            db,
            data,
            file.content_type or "image/jpeg",
            top_k=top_k,
            verify=verify,
            include_audio=include_audio,
        )
    except agent.ImageUnreadable as exc:
        raise HTTPException(status_code=400, detail=f"Could not read that image: {exc}")

    return IdentifyAgentResponse(
        common_name=answer.common_name,
        scientific_name=answer.scientific_name,
        confidence=answer.confidence,
        uncertain=answer.uncertain,
        is_bird=answer.is_bird,
        decided_by=answer.decided_by,
        summary=answer.summary,
        summary_source=answer.summary_source,
        summary_model=answer.summary_model,
        facts=_facts_out(answer.sheet) if answer.sheet else None,
        candidates=[
            AgentCandidate(
                label_index=c.label_index,
                common_name=c.common_name,
                scientific_name=c.scientific_name,
                confidence=c.confidence,
                profile_url=f"/species/{quote(c.scientific_name)}" if c.scientific_name else None,
                image_url=(
                    f"/species/{quote(c.scientific_name)}/image" if c.scientific_name else None
                ),
            )
            for c in answer.candidates
        ],
        vision=VisionVerdict(
            ran=answer.vision.ran,
            agrees=answer.vision.agrees,
            is_bird=answer.vision.is_bird,
            suggested=answer.vision.suggested,
            note=answer.vision.note,
            model=answer.vision.model,
            elapsed_ms=answer.vision.elapsed_ms,
            error=answer.vision.error,
        ),
        warnings=answer.warnings,
        classifier_model=classifier.model_name() or None,
        timings_ms=answer.timings_ms,
    )


@router.post("/ask", response_model=AgentAskResponse)
async def ask(payload: AskRequest, db: DbDep):
    """Answer a question about one species, using only what the database holds.

    The facts are fetched before the model is called and it is given nothing
    else, so it cannot answer from its own recollection. Asked something the
    atlas does not record, it is instructed to say so — and if no model is
    reachable the reply is the species summary instead, because a template
    cannot honestly address an arbitrary question.
    """
    sheet, answer, source, model = await agent.ask(db, payload.name, payload.question)
    if sheet is None:
        raise not_found("species", payload.name)
    return AgentAskResponse(
        scientific_name=sheet.scientific_name,
        common_name=sheet.common_name,
        question=payload.question,
        answer=answer,
        source=source,
        model=model,
        facts=_facts_out(sheet),
    )


@router.get("/species/{name}", response_model=IdentifyAgentResponse)
async def describe(
    name: SpeciesName,
    db: DbDep,
    include_audio: bool = Query(True, description="Offer a cached recording if one exists"),
):
    """The same written answer as /identify, for a species named directly.

    Shares the identify response shape on purpose: a frontend that renders one
    renders the other with no second code path. There was no photo, so
    confidence is 1 and the vision block reports that it did not run.
    """
    sheet = await factsheet.build(db, name, include_audio=include_audio)
    if sheet is None:
        raise not_found("species", name)

    summary, source, model = await run_in_threadpool(agent.write_summary, sheet)
    return IdentifyAgentResponse(
        common_name=sheet.common_name,
        scientific_name=sheet.scientific_name,
        confidence=1.0,
        uncertain=False,
        is_bird=True,
        decided_by="classifier",
        summary=summary,
        summary_source=source,
        summary_model=model,
        facts=_facts_out(sheet),
        candidates=[],
        vision=VisionVerdict(ran=False),
        warnings=[],
        classifier_model=None,
        timings_ms={},
    )
