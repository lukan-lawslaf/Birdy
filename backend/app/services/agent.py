"""The identification agent.

One request in — a photo — and a displayable answer out. The pipeline:

    1. the local ONNX classifier ranks its 526 classes          (~37 ms, free)
    2. if its top-1 is weak, a vision model gives a second opinion
    3. the database is searched for the winning species          (deterministic)
    4. a text model writes the summary from those rows alone
    5. anything that failed degrades instead of erroring

Step 2 only fires below `agent_vision_threshold`. The classifier is 98% top-1 on
its own validation split, so a low score usually means the bird is not one of
its classes at all — which is the one case a second opinion is worth paying an
API call for. Step 4 falls back to prose this module writes itself, so a spent
free-tier quota costs fluency and nothing else.

Nothing here lets a model choose which facts to fetch. The model sees the rows
after they are gathered and is told to use only those, which is why the prose
and the stat cards can never disagree.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services import classifier, factsheet, llm, resolve
from app.services.factsheet import FactSheet

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM = (
    "You are a field-guide writer for a bird atlas. You will be given verified "
    "database records for one species. Write about that species using only those "
    "records plus the Wikipedia paragraph provided.\n"
    "Rules:\n"
    "- Never invent a number, measurement, status or place that is not given.\n"
    "- If a fact is absent, say nothing about it. Do not note its absence.\n"
    "- No preamble, no headings, no bullet points, no markdown.\n"
    "- Plain prose, 3 to 5 sentences, confident and readable.\n"
    "- Start with what the bird is and where it lives, then size or diet, then "
    "conservation status if one is given."
)

VISION_SYSTEM = (
    "You are verifying an automated bird identification. Answer with one JSON "
    "object and nothing else."
)


class ImageUnreadable(ValueError):
    """The upload could not be decoded as an image.

    Its own type so the router can answer 400 for a bad upload without also
    swallowing a database or model failure further down the pipeline, which
    deserves a 500 and a log line rather than "could not read that image".
    """


@dataclass
class Candidate:
    label_index: int
    common_name: str
    scientific_name: str | None
    confidence: float


@dataclass
class VisionCheck:
    ran: bool = False
    agrees: bool | None = None
    is_bird: bool | None = None
    suggested: str | None = None
    note: str | None = None
    model: str | None = None
    elapsed_ms: float | None = None
    error: str | None = None


@dataclass
class AgentAnswer:
    scientific_name: str | None
    common_name: str | None
    confidence: float
    uncertain: bool
    is_bird: bool
    candidates: list[Candidate]
    decided_by: str
    vision: VisionCheck
    sheet: FactSheet | None
    summary: str | None
    summary_source: str
    summary_model: str | None
    warnings: list[str] = field(default_factory=list)
    timings_ms: dict[str, float] = field(default_factory=dict)


def _json_from(raw: str) -> dict:
    """Pull the first JSON object out of a model's reply.

    Models wrap JSON in prose or fences even when told not to, so this finds the
    outermost braces rather than trusting the whole string to parse.
    """
    fenced = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(fenced)
    except Exception:
        pass
    match = re.search(r"\{.*\}", fenced, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return {}


def _verify_prompt(candidates: list[Candidate]) -> str:
    listed = "\n".join(
        f"{i + 1}. {c.common_name}"
        + (f" ({c.scientific_name})" if c.scientific_name else "")
        + f" — {c.confidence:.1%}"
        for i, c in enumerate(candidates)
    )
    return (
        "An image classifier was unsure about this photo. Its candidates:\n\n"
        f"{listed}\n\n"
        "Look at the photo and reply with exactly this JSON:\n"
        '{"is_bird": true/false, "agrees": true/false, '
        '"best": "<the candidate name you agree with, or null>", '
        '"species_guess": "<your own identification as an English common name, or null>", '
        '"note": "<one short sentence of reasoning>"}\n\n'
        "Set agrees to true only if the bird in the photo really is one of the "
        "candidates. If you recognise a different species, put it in species_guess. "
        "If the photo has no bird in it, set is_bird to false."
    )


def _run_vision(data: bytes, mime: str, candidates: list[Candidate]) -> VisionCheck:
    """Blocking. Never raises — a failed cross-check is not a failed request."""
    check = VisionCheck(ran=True)
    try:
        result = llm.look(data, mime, _verify_prompt(candidates), VISION_SYSTEM)
        check.model = f"{result.provider}:{result.model}"
        check.elapsed_ms = round(result.elapsed_ms, 1)
        parsed = _json_from(result.text)
        if not parsed:
            check.error = "could not parse the model's reply"
            check.note = result.text[:200]
            return check
        check.agrees = parsed.get("agrees") if isinstance(parsed.get("agrees"), bool) else None
        check.is_bird = parsed.get("is_bird") if isinstance(parsed.get("is_bird"), bool) else None
        guess = parsed.get("species_guess") or parsed.get("best")
        check.suggested = guess.strip() if isinstance(guess, str) and guess.strip() else None
        note = parsed.get("note")
        check.note = note.strip() if isinstance(note, str) else None
    except Exception as exc:
        check.error = str(exc)[:200]
        logger.warning("Vision cross-check failed: %s", exc)
    return check


def write_summary(sheet: FactSheet) -> tuple[str, str, str | None]:
    """(prose, source, model). Blocking. Falls back to a template, never raises."""
    prompt = (
        f"Database records for {sheet.scientific_name}"
        + (f" ({sheet.common_name})" if sheet.common_name else "")
        + f":\n\n{sheet.prompt_facts}\n\nWrite the field-guide paragraph now."
    )
    try:
        result = llm.generate(prompt, SUMMARY_SYSTEM, temperature=0.3)
        return result.text, "model", f"{result.provider}:{result.model}"
    except Exception as exc:
        logger.info("Falling back to template summary: %s", exc)
        return _template_summary(sheet), "template", None


def _template_summary(sheet: FactSheet) -> str:
    """Readable prose assembled from the rows, for when no model answers.

    Less fluent than a model's, and deliberately so: every clause is a field
    that exists, which makes it impossible for this path to say anything wrong.
    """
    name = sheet.common_name or sheet.scientific_name
    sentences = []

    opening = f"{name} ({sheet.scientific_name})"
    lineage = [p for p in (sheet.family, sheet.order_name) if p]
    if lineage:
        opening += f" belongs to the family {lineage[0]}" + (
            f" in the order {lineage[1]}" if len(lineage) > 1 else ""
        )
        sentences.append(opening + ".")
    else:
        sentences.append(opening + " is catalogued in this atlas.")

    habitat_bits = []
    if sheet.habitat:
        habitat_bits.append(f"occupies {sheet.habitat.lower()} habitat")
    if sheet.migration_label:
        habitat_bits.append(f"is {sheet.migration_label.lower()}")
    if sheet.primary_lifestyle:
        habitat_bits.append(f"has a mainly {sheet.primary_lifestyle.lower()} lifestyle")
    if habitat_bits:
        sentences.append(f"It {', and '.join(habitat_bits)}.")

    body = []
    if sheet.mass_g is not None:
        body.append(f"a mean body mass of {sheet.mass_g:g} g")
    if sheet.wing_length_mm is not None:
        body.append(f"a wing length of about {sheet.wing_length_mm:g} mm")
    if body:
        sentences.append(f"Measurements in AVONET give it {' and '.join(body)}.")

    if sheet.trophic_niche:
        sentences.append(f"Its diet places it in the {sheet.trophic_niche.lower()} trophic niche.")

    if sheet.iucn_label:
        status = f"BirdLife lists it as {sheet.iucn_label}"
        if sheet.population_trend:
            status += f", with a {sheet.population_trend.lower()} population"
        sentences.append(status + ".")

    where = []
    if sheet.top_countries:
        where.append(f"most records come from {sheet.top_countries}")
    if sheet.peak_month:
        where.append(f"reports peak in {sheet.peak_month}")
    if where:
        sentences.append(f"In GBIF, {' and '.join(where)}.")

    return " ".join(sentences)


async def _classify(data: bytes, top_k: int):
    """Run inference, turning any decode failure into `ImageUnreadable`."""
    from fastapi.concurrency import run_in_threadpool

    try:
        return await run_in_threadpool(classifier.predict, data, top_k)
    except Exception as exc:
        raise ImageUnreadable(str(exc)) from exc


async def identify(
    db: AsyncSession,
    data: bytes,
    mime: str,
    top_k: int = 5,
    verify: str = "auto",
    include_audio: bool = True,
) -> AgentAnswer:
    """Run the whole pipeline over one uploaded image.

    `verify` is "auto" (cross-check only below the confidence threshold),
    "always", or "never".
    """
    from fastapi.concurrency import run_in_threadpool

    timings: dict[str, float] = {}
    started = time.perf_counter()

    scored, infer_ms, _ = await _classify(data, top_k)
    timings["classify"] = round(infer_ms, 1)

    # Resolve every candidate's names in one pass so the vision prompt and the
    # response can both show scientific names.
    candidates: list[Candidate] = []
    for index, confidence in scored:
        label = classifier.label_for(index) or f"class {index}"
        found = await resolve.resolve_species(db, label)
        candidates.append(
            Candidate(
                label_index=index,
                common_name=(found.common_name if found and found.common_name else label.title()),
                scientific_name=found.scientific_name if found else None,
                confidence=round(confidence, 6),
            )
        )

    best = candidates[0]
    threshold = settings.agent_vision_threshold
    weak = best.confidence < threshold
    should_verify = verify == "always" or (verify == "auto" and weak)

    vision = VisionCheck()
    if should_verify and llm.vision_enabled():
        vision = await run_in_threadpool(_run_vision, data, mime, candidates)
        if vision.elapsed_ms:
            timings["vision"] = vision.elapsed_ms
    elif should_verify:
        vision.error = "no vision model configured"

    decided_by = "classifier"
    chosen_name = best.scientific_name or best.common_name
    warnings: list[str] = []

    if vision.is_bird is False:
        warnings.append(
            "The vision model does not think this photo contains a bird. "
            "The identification below is the classifier's best guess anyway."
        )
    if vision.ran and vision.agrees is False and vision.suggested:
        # Only accept an override that actually exists in our database —
        # otherwise there is nothing to show for it.
        alternative = await resolve.resolve_species(db, vision.suggested)
        if alternative:
            chosen_name = alternative.scientific_name
            decided_by = "classifier+vision"
            warnings.append(
                f"The classifier's first guess was {best.common_name} "
                f"({best.confidence:.0%}); the vision model identified "
                f"{alternative.common_name or alternative.scientific_name} instead, "
                "and that is what is shown."
            )
        else:
            warnings.append(
                f"The vision model suggested '{vision.suggested}', which is not in "
                "this database, so the classifier's guess is shown."
            )
    elif weak:
        warnings.append(
            f"Low confidence ({best.confidence:.0%}). The classifier only knows "
            "526 species, so a bird outside that list is reported as the nearest "
            "one it does know."
        )

    t0 = time.perf_counter()
    sheet = await factsheet.build(db, chosen_name, include_audio=include_audio) if chosen_name else None
    timings["database"] = round((time.perf_counter() - t0) * 1000, 1)

    summary: str | None = None
    source = "none"
    model_used: str | None = None
    if sheet is not None:
        t0 = time.perf_counter()
        summary, source, model_used = await run_in_threadpool(write_summary, sheet)
        timings["summary"] = round((time.perf_counter() - t0) * 1000, 1)
    else:
        warnings.append(
            f"'{chosen_name}' could not be matched to a species in the database, "
            "so no details are available."
        )

    timings["total"] = round((time.perf_counter() - started) * 1000, 1)

    return AgentAnswer(
        scientific_name=sheet.scientific_name if sheet else None,
        common_name=(sheet.common_name if sheet else None) or best.common_name,
        confidence=best.confidence,
        uncertain=weak or decided_by == "classifier+vision",
        is_bird=vision.is_bird is not False,
        candidates=candidates,
        decided_by=decided_by,
        vision=vision,
        sheet=sheet,
        summary=summary,
        summary_source=source,
        summary_model=model_used,
        warnings=warnings,
        timings_ms=timings,
    )


ASK_SYSTEM = (
    "You answer questions about one bird species for a bird atlas. You are given "
    "that species' verified database records. Answer only from those records and "
    "the Wikipedia paragraph provided. If the records do not contain the answer, "
    "say plainly that the atlas does not hold that information. Two or three "
    "sentences, plain prose, no markdown."
)


async def ask(db: AsyncSession, name: str, question: str) -> tuple[FactSheet | None, str, str, str | None]:
    """Answer a follow-up question about a species. (sheet, answer, source, model).

    Grounded the same way identify is: the facts are fetched first and the model
    is given nothing else. Without a model this returns the template summary
    rather than attempting to answer, because a template cannot address an
    arbitrary question honestly.
    """
    from fastapi.concurrency import run_in_threadpool

    sheet = await factsheet.build(db, name, include_audio=False)
    if sheet is None:
        return None, "", "none", None

    prompt = (
        f"Species records:\n\n{sheet.prompt_facts}\n\n"
        f"Question: {question.strip()}\n\nAnswer:"
    )
    try:
        result = await run_in_threadpool(lambda: llm.generate(prompt, ASK_SYSTEM, temperature=0.2))
        return sheet, result.text, "model", f"{result.provider}:{result.model}"
    except Exception as exc:
        logger.info("Ask fell back to the summary template: %s", exc)
        return sheet, _template_summary(sheet), "template", None
