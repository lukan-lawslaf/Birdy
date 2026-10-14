"""Xeno-canto: catalogue entries stored locally, audio streamed on demand.

Only metadata is kept. The recordings themselves are proxied through from the
archive at play time rather than mirrored, for three reasons: around ten
thousand files would dwarf the database; the licence is per recording, and
pointing at the original is the clearest way to honour it; and a local copy
would silently go stale against re-uploads and corrections.

The archive is queried once per species and the answer is kept, so a species
page opened repeatedly costs one request rather than one per view.

The API key is deliberately *not* stored in the database — it is attached when
a stream is requested, so the database file stays free of credentials.
"""

from __future__ import annotations

import threading
import time

import requests
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.models import SpeciesAudio

# Xeno-canto rejects clients that do not identify themselves, the same way
# Wikimedia does.
UA = {
    "User-Agent": "bird-atlas/0.1 (educational bird data project; contact: bird-atlas@example.org)"
}

# A species is asked about at most this often. Recordings are added to the
# archive over months, so there is nothing to gain from asking more.
QUERY_TTL_SECONDS = 6 * 3600

# Quality is graded A (cleanest) to E. Sorting on it puts the best sample of a
# species first, which is what a page wants to play by default.
QUALITY_ORDER = {"a": 0, "b": 1, "c": 2, "d": 3, "e": 4}

# The archive serves the file the recordist uploaded and never transcodes, so
# an uncompressed WAV is 10-100x the size of the same recording as mp3 — 41
# seconds of WAV measured 14.5 MB. Compressed formats are therefore preferred
# ahead of quality: a slightly rougher mp3 beats a flawless 50 MB WAV on a
# phone. Anything unlisted sorts last.
FORMAT_ORDER = {
    "mp3": 0,
    "m4a": 1,
    "aac": 1,
    "ogg": 2,
    "opus": 2,
    "flac": 3,
    "wav": 4,
}

_LAST_QUERY: dict[str, float] = {}
_LAST_QUERY_LOCK = threading.Lock()


def _recently_queried(scientific_name: str) -> bool:
    key = scientific_name.casefold()
    with _LAST_QUERY_LOCK:
        stamped = _LAST_QUERY.get(key)
        return stamped is not None and (time.time() - stamped) < QUERY_TTL_SECONDS


def _mark_queried(scientific_name: str) -> None:
    with _LAST_QUERY_LOCK:
        _LAST_QUERY[scientific_name.casefold()] = time.time()


def _clean(value) -> str | None:
    """The archive returns empty strings where it has nothing to say."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _absolute(url: str | None) -> str | None:
    """The API returns protocol-relative URLs (`//xeno-canto.org/...`)."""
    if not url:
        return None
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return "https://xeno-canto.org" + url
    return url


def _to_row(recording: dict) -> dict | None:
    """One archive recording as a row. Returns None if it has no catalogue id."""
    xc_id = _clean(recording.get("id"))
    if not xc_id or not xc_id.isdigit():
        return None

    genus = _clean(recording.get("gen")) or ""
    epithet = _clean(recording.get("sp")) or ""
    scientific_name = f"{genus} {epithet}".strip() or _clean(recording.get("en")) or ""
    if not scientific_name:
        return None

    def number(value) -> float | None:
        try:
            return float(str(value).strip())
        except (TypeError, ValueError):
            return None

    sono = recording.get("sono") or {}

    # The archive does not just fail to transcode — it does not even tell you
    # the format. The only signal is the extension on the original filename,
    # which is what decides whether this is a 400 KB mp3 or a 50 MB WAV.
    file_name = _clean(recording.get("file-name")) or ""
    extension = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else None
    if extension and (len(extension) > 4 or not extension.isalnum()):
        extension = None

    return {
        "xc_id": int(xc_id),
        "scientific_name": scientific_name,
        "common_name": _clean(recording.get("en")),
        "recordist": _clean(recording.get("rec")),
        "country": _clean(recording.get("cnt")),
        "locality": _clean(recording.get("loc")),
        "latitude": number(recording.get("lat")),
        # The field is `lon`, not `lng` — `lng` silently reads as None.
        "longitude": number(recording.get("lon")),
        "sound_type": _clean(recording.get("type")),
        "sex": _clean(recording.get("sex")),
        "stage": _clean(recording.get("stage")),
        "quality": _clean(recording.get("q")),
        "format": extension,
        "length": _clean(recording.get("length")),
        "recorded_date": _clean(recording.get("date")),
        "license": _clean(recording.get("lic")),
        "remarks": _clean(recording.get("rmk")),
        "file_url": _absolute(recording.get("file")),
        "page_url": _absolute(recording.get("url")),
        "sonogram_url": _absolute(sono.get("med") or sono.get("small") or sono.get("large")),
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }


def _query(scientific_name: str, per_page: int) -> list[dict] | None:
    """One archive search, in a worker thread.

    Returns None when the key is missing or the archive is unreachable, so the
    caller can fall back to whatever is already cached instead of failing.
    """
    if not settings.xeno_canto_enabled:
        return None

    try:
        response = requests.get(
            f"{settings.xeno_canto_base_url}/recordings",
            params={
                # API v3 rejects free text — it only accepts tagged queries, and
                # `sp:"Genus species"` is the one that matches a full binomial.
                # English names are not safe to search on: `en:"Rock Pigeon"`
                # returns Chestnut-quilled Rock Pigeon.
                "query": f'sp:"{scientific_name}"',
                "key": settings.xeno_canto_key,
                "per_page": per_page,
            },
            headers=UA,
            timeout=30,
        )
    except Exception:
        return None

    if response.status_code != 200:
        return None
    try:
        payload = response.json()
    except ValueError:
        return None
    if not isinstance(payload, dict):
        return None
    recordings = payload.get("recordings")
    return recordings if isinstance(recordings, list) else []


def _sort_key(row: SpeciesAudio) -> tuple:
    """Compressed before uncompressed, then the archive's quality grade.

    Format leads because the archive does not transcode: a 41-second WAV was
    measured at 14.5 MB, and a page that plays one by default would spend a
    phone's data allowance on a single bird.
    """
    fmt = FORMAT_ORDER.get((row.format or "").casefold(), 5)
    quality = QUALITY_ORDER.get((row.quality or "z").casefold(), 5)
    return (fmt, quality, row.xc_id)


async def _store(db, rows: list[dict]) -> None:
    """Insert recordings we have not seen before, refresh the ones we have."""
    if not rows:
        return
    ids = [r["xc_id"] for r in rows]
    existing = {
        row.xc_id: row
        for row in (
            await db.execute(select(SpeciesAudio).where(SpeciesAudio.xc_id.in_(ids)))
        ).scalars()
    }
    for values in rows:
        row = existing.get(values["xc_id"])
        if row is None:
            db.add(SpeciesAudio(**values))
        else:
            for field, value in values.items():
                setattr(row, field, value)
    await db.commit()


async def recordings(db, scientific_name: str, limit: int = 10) -> tuple[list[SpeciesAudio], bool]:
    """The recordings held for a species, newest catalogue additions included.

    Returns the rows and whether they came from the local cache. The archive is
    only asked when the cache is empty or the species has not been looked up
    recently, and a failure there degrades to the cache rather than an error —
    a species page should still render when Xeno-canto is down.
    """
    cached = (
        await db.execute(
            select(SpeciesAudio).where(SpeciesAudio.scientific_name == scientific_name)
        )
    ).scalars().all()
    cached = sorted(cached, key=_sort_key)[:limit]

    if cached and _recently_queried(scientific_name):
        return cached, True

    # Ask for more than we need so the quality sort has something to choose
    # from — the archive returns them in relevance order, not best-first.
    fetched = await run_in_threadpool(_query, scientific_name, max(limit * 5, 50))
    if fetched is None:
        return cached, bool(cached)

    _mark_queried(scientific_name)
    rows = [row for row in (_to_row(recording) for recording in fetched) if row]
    await _store(db, rows)

    fresh = (
        await db.execute(
            select(SpeciesAudio).where(SpeciesAudio.scientific_name == scientific_name)
        )
    ).scalars().all()
    # The archive writes the binomial its own way; a recording filed under a
    # subspecies still belongs to this species, so fall back to the fetch.
    if not fresh:
        fresh = [SpeciesAudio(**values) for values in rows]
    return sorted(fresh, key=_sort_key)[:limit], False


async def get(db, xc_id: int) -> SpeciesAudio | None:
    return (
        await db.execute(select(SpeciesAudio).where(SpeciesAudio.xc_id == xc_id))
    ).scalars().first()


def stream_url_for(xc_id: int) -> str:
    """The API endpoint a frontend should point an <audio> element at."""
    return f"/species/audio/{xc_id}/stream"


def with_key(url: str) -> str:
    """Attach the API key to an archive download URL, at request time only."""
    if not settings.xeno_canto_enabled:
        return url
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}key={settings.xeno_canto_key}"
