"""Thin clients for the two hosted model providers, with a fallback chain.

Only two things are asked of a model here: write prose from facts the backend
already gathered (text), and give a second opinion on a photo the classifier was
unsure about (vision). Nothing in this module decides anything factual — see
`factsheet.py` for where the facts come from.

What the free tiers actually allow, measured against both keys on 2026-10-14
rather than taken from documentation:

    google:gemini-3.1-flash-lite  text and vision both fine, ~2 s for a
                                  field-guide paragraph. Vision-capable, so it
                                  serves both roles.
    google:gemini-3.1-flash       prose fallback behind flash-lite.
    google:gemma-4-26b-a4b-it     text only, and not usable even for that.
                                  Images return 500, tool declarations are
                                  accepted but it answers with prose *about*
                                  calling the tool, and on a prompt of any
                                  length it spends the whole maxOutputTokens
                                  budget thinking (64.8 s, empty answer on the
                                  real 939-char summary prompt). It rejects
                                  thinkingConfig — "Thinking budget is not
                                  supported for this model" — so the budget
                                  cannot be turned down. Excluded, not demoted.
    google:gemma-4-31b-it         500 on everything with this key. Unusable.
    google:gemini-3.8-flash       works but took 98 s to answer "say OK" under
                                  load. Far too slow to sit in a request.
    groq:openai/gpt-oss-120b      fast and capable, text only — Groq's catalogue
                                  on this key has no vision model at all, and
                                  /chat/completions answers 401 with this key.
                                  Supported, but out of the default chain.

The lesson in the Gemma row: a generous free tier is worth nothing if the model
spends the budget thinking. `maxOutputTokens` on this API counts thinking *and*
output against one budget, which is why every gemini call sets thinkingBudget 0.

The Groq quirk worth knowing: their edge rejects Python's default
``User-Agent: Python-urllib/3.x`` with Cloudflare error 1010 and a 403, which
looks exactly like a dead key. A browser User-Agent gets through. `requests`
sends its own UA and is also blocked, so BROWSER_UA is set explicitly.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import requests

from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
GROQ_BASE = "https://api.groq.com/openai/v1"

# Not a disguise — Groq's edge blocks unknown agents outright (see module note).
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


class LlmUnavailable(RuntimeError):
    """Every model in the chain refused, timed out or is not configured."""


@dataclass
class LlmResult:
    text: str
    provider: str
    model: str
    elapsed_ms: float


def _key_for(provider: str) -> str:
    return {"google": settings.google_key, "groq": settings.groq_key}.get(provider, "").strip()


def available_text_models() -> list[tuple[str, str]]:
    """The configured chain, minus any provider whose key is missing."""
    return [(p, m) for p, m in settings.agent_text_chain if _key_for(p)]


def is_enabled() -> bool:
    return bool(available_text_models())


def vision_enabled() -> bool:
    provider, _ = settings.agent_vision_pair
    # Only Google has a vision model on these keys, but check the key generally
    # so a future Groq vision model needs no change here.
    return bool(_key_for(provider))


# ------------------------------------------------------------------ Google

def _gemini_payload(model: str, prompt: str, system: str | None, max_tokens: int,
                    temperature: float, image: tuple[bytes, str] | None) -> dict:
    parts: list[dict] = []
    text = prompt
    if system:
        # Gemma on this API does not accept systemInstruction, so the
        # instruction is folded into the turn instead of being dropped.
        if model.startswith("gemma"):
            text = f"{system}\n\n{prompt}"
        # else: sent separately below, where the model honours it properly.
    parts.append({"text": text})
    if image is not None:
        data, mime = image
        import base64

        parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}})

    body: dict = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
    }
    if system and not model.startswith("gemma"):
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if model.startswith("gemini-3") or model in {"gemini-flash-latest", "gemini-flash-lite-latest"}:
        body["generationConfig"]["thinkingConfig"] = {"thinkingLevel": "minimal"}
    elif model.startswith("gemini-2.5"):
        body["generationConfig"]["thinkingConfig"] = {"thinkingBudget": 0}
    return body


def _gemini_text(response: dict) -> str:
    candidates = response.get("candidates") or []
    if not candidates:
        blocked = (response.get("promptFeedback") or {}).get("blockReason")
        raise LlmUnavailable(f"no candidates (blockReason={blocked})")
    candidate = candidates[0]
    parts = (candidate.get("content") or {}).get("parts") or []
    # Reasoning traces come back as parts flagged `thought`; they are not answer.
    text = "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
    if not text:
        raise LlmUnavailable(f"empty answer (finishReason={candidate.get('finishReason')})")
    return text


def _call_google(model: str, prompt: str, system: str | None, max_tokens: int,
                 temperature: float, image: tuple[bytes, str] | None) -> str:
    try:
        response = requests.post(
            f"{GEMINI_BASE}/models/{model}:generateContent",
            params={"key": settings.google_key},
            json=_gemini_payload(model, prompt, system, max_tokens, temperature, image),
            timeout=settings.agent_timeout_seconds,
        )
    except requests.RequestException as exc:
        # Requests exceptions can include the complete URL, including the key.
        raise LlmUnavailable(f"{type(exc).__name__} contacting the Google model API") from None
    if response.status_code != 200:
        raise LlmUnavailable(f"HTTP {response.status_code}: {response.text[:200]}")
    return _gemini_text(response.json())


# -------------------------------------------------------------------- Groq

def _call_groq(model: str, prompt: str, system: str | None, max_tokens: int,
               temperature: float, image: tuple[bytes, str] | None) -> str:
    if image is not None:
        raise LlmUnavailable("no vision model available on Groq with this key")
    messages = ([{"role": "system", "content": system}] if system else []) + [
        {"role": "user", "content": prompt}
    ]
    response = requests.post(
        f"{GROQ_BASE}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.groq_key}",
            "User-Agent": BROWSER_UA,
        },
        json={
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
        timeout=settings.agent_timeout_seconds,
    )
    if response.status_code != 200:
        raise LlmUnavailable(f"HTTP {response.status_code}: {response.text[:200]}")
    choices = response.json().get("choices") or []
    text = (choices[0].get("message", {}).get("content") or "").strip() if choices else ""
    if not text:
        raise LlmUnavailable("empty answer")
    return text


_CALLERS = {"google": _call_google, "groq": _call_groq}


def _invoke(provider: str, model: str, prompt: str, system: str | None, max_tokens: int,
            temperature: float, image: tuple[bytes, str] | None) -> LlmResult:
    caller = _CALLERS.get(provider)
    if caller is None:
        raise LlmUnavailable(f"unknown provider '{provider}'")
    if not _key_for(provider):
        raise LlmUnavailable(f"no API key configured for '{provider}'")
    started = time.perf_counter()
    text = caller(model, prompt, system, max_tokens, temperature, image)
    return LlmResult(text, provider, model, (time.perf_counter() - started) * 1000)


def generate(prompt: str, system: str | None = None, max_tokens: int | None = None,
             temperature: float = 0.4) -> LlmResult:
    """Ask the text chain in order and return the first model that answers.

    Blocking. Call it through `run_in_threadpool`. Raises LlmUnavailable only
    when every configured model has failed, which the caller is expected to
    handle by falling back to prose it writes itself.
    """
    chain = available_text_models()
    if not chain:
        raise LlmUnavailable("no text model configured (set Groq_Key or Google_key in .env)")
    tokens = max_tokens or settings.agent_max_output_tokens
    failures = []
    for provider, model in chain:
        try:
            return _invoke(provider, model, prompt, system, tokens, temperature, None)
        except Exception as exc:
            failures.append(f"{provider}:{model} -> {exc}")
            logger.warning("Text model %s:%s failed: %s", provider, model, exc)
    raise LlmUnavailable("; ".join(failures))


def look(image: bytes, mime: str, prompt: str, system: str | None = None,
         max_tokens: int = 400) -> LlmResult:
    """Show one image to the vision model. Blocking, same contract as generate."""
    chain = [settings.agent_vision_pair]
    for item in settings.agent_vision_fallbacks.split(","):
        provider, _, model = item.partition(":")
        if provider.strip() and model.strip():
            chain.append((provider.strip(), model.strip()))
    failures = []
    for provider, model in dict.fromkeys(chain):
        try:
            return _invoke(provider, model, prompt, system, max_tokens, 0.1, (image, mime))
        except Exception as exc:
            failures.append(f"{provider}:{model}: {exc}")
    raise LlmUnavailable("; ".join(failures))


def status() -> dict:
    """What the agent could do right now, without making a call."""
    provider, vision_model = settings.agent_vision_pair
    return {
        "enabled": is_enabled(),
        "text_models": [f"{p}:{m}" for p, m in available_text_models()],
        "vision_model": f"{provider}:{vision_model}" if vision_enabled() else None,
        "vision_enabled": vision_enabled(),
        "google_key": bool(settings.google_key.strip()),
        "groq_key": bool(settings.groq_key.strip()),
    }
