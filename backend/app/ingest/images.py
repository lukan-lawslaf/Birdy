"""Populate species_images with one representative picture per species.

Two sources, deliberately stored two different ways:

1. The image dataset itself (local parquet). One picture per class, stored as
   JPEG bytes, so the 525 species the classifier knows are always available
   offline with no network call at all.

2. Wikipedia, by scientific name, for every other species. Stored as URLs only
   (thumbnail, original, page). We do not download these: ~11,000 extra JPEGs
   would bloat the database and cost download+encode time for images that are
   browsed rather than fed to a model.

The Wikipedia side uses the same network discipline as the Rayquaza project:
50 titles per request, 1.0 s between requests, up to 5 retries, and it honours
the server's Retry-After header on 429/503. Pacing faster than this is what got
earlier runs throttled into HTML error pages.
"""

import io
import time

import requests
from PIL import Image
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.ingest import sources as src
from app.models import Conservation, Species, SpeciesImage, Trait

WIKI_API = "https://en.wikipedia.org/w/api.php"
UA = {"User-Agent": "bird-atlas/0.1 (species image mapping; educational project)"}

DATASET_MAX = 640       # longest edge for the byte-stored dataset pictures
JPEG_QUALITY = 82
THUMB_SIZE = 480        # width Wikipedia is asked to return for the thumbnail URL
TITLE_BATCH = 50        # Wikipedia allows 50 titles per request
REQUEST_DELAY = 1.0     # seconds between batches; Wikimedia throttles faster clients
MAX_RETRIES = 5


def _encode(raw: bytes, max_edge: int) -> tuple[bytes, int, int] | None:
    """Decode, downscale and re-encode as JPEG. Returns (bytes, w, h)."""
    try:
        im = Image.open(io.BytesIO(raw))
        im = im.convert("RGB")
    except Exception:
        return None
    im.thumbnail((max_edge, max_edge), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue(), im.width, im.height


def _from_dataset(db: Session) -> int:
    """One picture per image class, from the local parquet, stored as bytes."""
    import pyarrow.parquet as pq

    path = src.BULK / "birds-525" / "data" / "validation-00000-of-00001.parquet"
    if not path.exists():
        print("      dataset parquet not found, skipping:", path, flush=True)
        return 0

    table = pq.read_table(str(path))
    images = table.column("image").to_pylist()
    labels = table.column("label").to_pylist()

    first_of_label: dict[int, bytes] = {}
    for raw, label in zip(images, labels):
        first_of_label.setdefault(int(label), raw.get("bytes") or raw.get("path"))

    meta = {
        s.label_index: (s.name, s.scientific_name)
        for s in db.query(Species).all()
    }

    rows = []
    for label, raw in first_of_label.items():
        if isinstance(raw, str):  # "path" form, no bytes embedded
            continue
        enc = _encode(raw, DATASET_MAX)
        if not enc:
            continue
        blob, w, h = enc
        name, sci = meta.get(label, (None, None))
        rows.append({
            "scientific_name": sci,
            "common_name": name,
            "label_index": label,
            "source": "dataset",
            "source_url": None,
            "original_url": None,
            "wikipedia_url": None,
            "attribution": "bird-525 image dataset",
            "license": None,
            "width": w, "height": h, "bytes_len": len(blob),
            "image": blob,
        })
    if rows:
        db.execute(insert(SpeciesImage), rows)
        db.commit()
    return len(rows)


def _request_with_retry(params: dict) -> dict | None:
    """GET the Wikipedia API with exponential backoff on 429/5xx, honouring the
    server's Retry-After header. Returns parsed JSON, or None if every attempt
    failed. A throttled batch returns an HTML page rather than JSON, which is
    what the ValueError on .json() catches."""
    backoff = 2.0
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.get(WIKI_API, params=params, headers=UA, timeout=30)
            if r.status_code == 429 or r.status_code >= 500:
                retry_after = r.headers.get("Retry-After")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else backoff
                print("      Wikipedia %s (attempt %d/%d), waiting %.1fs"
                      % (r.status_code, attempt, MAX_RETRIES, wait), flush=True)
                time.sleep(wait)
                backoff = min(backoff * 2, 30.0)
                continue
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError):
            time.sleep(backoff)
            backoff = min(backoff * 2, 30.0)
    return None


def _fetch_batch(titles: list[str]) -> dict[str, dict]:
    """Query up to TITLE_BATCH scientific names at once.

    Returns {requested_title: {thumb, original, page, width, height}}. Wikipedia
    normalises titles and follows redirects, so every requested title is mapped
    to the page it actually resolved to and only one entry per requested title
    comes back. Never raises; an empty dict means the whole batch failed."""
    params = {
        "action": "query",
        "format": "json",
        "redirects": 1,
        "prop": "pageimages|info",
        "piprop": "thumbnail|original",
        "pithumbsize": THUMB_SIZE,
        "pilimit": len(titles),
        "inprop": "url",
        "titles": "|".join(titles),
    }
    payload = _request_with_retry(params)
    time.sleep(REQUEST_DELAY)
    if payload is None:
        return {}

    query = payload.get("query", {})

    # map every requested title to the title Wikipedia actually resolved to
    alias: dict[str, str] = {t: t for t in titles}
    for key in ("normalized", "redirects"):
        for m in query.get(key, []) or []:
            alias[m["from"]] = m["to"]
    # follow two-step chains (normalised then redirected)
    for _ in range(2):
        for frm, to in list(alias.items()):
            if to in alias and alias[to] != to:
                alias[frm] = alias[to]

    page_by_title = {
        page["title"]: page
        for page in (query.get("pages") or {}).values()
        if page.get("title")
    }

    out: dict[str, dict] = {}
    for requested in titles:
        page = page_by_title.get(alias.get(requested, requested))
        if not page:
            continue
        thumb = page.get("thumbnail") or {}
        original = page.get("original") or {}
        out[requested] = {
            "thumb": thumb.get("source"),
            "original": original.get("source"),
            "page": page.get("fullurl"),
            "width": thumb.get("width"),
            "height": thumb.get("height"),
        }
    return out


def _from_wikipedia(db: Session, limit: int | None = None) -> int:
    """One URL row per species that does not already have a picture."""
    have = {
        row[0]
        for row in db.execute(select(SpeciesImage.scientific_name)).all()
        if row[0]
    }

    names: list[str] = []
    seen: set[str] = set()
    for (name,) in db.query(Trait.scientific_name).all():
        if name and name not in seen:
            seen.add(name); names.append(name)
    for (name,) in db.query(Conservation.scientific_name).all():
        if name and name not in seen:
            seen.add(name); names.append(name)
    names = [n for n in names if n not in have]
    if limit:
        names = names[:limit]

    print("      %d species to look up on Wikipedia" % len(names), flush=True)

    stored = 0
    for i in range(0, len(names), TITLE_BATCH):
        batch = names[i : i + TITLE_BATCH]
        found = _fetch_batch(batch)

        rows = []
        for title, info in found.items():
            if not info.get("thumb"):
                continue  # no lead image for this species
            rows.append({
                "scientific_name": title,
                "common_name": None,
                "label_index": None,
                "source": "wikipedia",
                "source_url": info["thumb"],
                "original_url": info["original"],
                "wikipedia_url": info["page"],
                "attribution": "Wikipedia / Wikimedia Commons",
                "license": None,
                "width": info["width"], "height": info["height"], "bytes_len": None,
                "image": None,
            })
        if rows:
            db.execute(insert(SpeciesImage), rows)
            db.commit()
            stored += len(rows)

        print("      %d rows stored; %d of %d names checked"
              % (stored, min(i + TITLE_BATCH, len(names)), len(names)), flush=True)

    return stored


def load_species_images(db: Session, wiki_limit: int | None = None, verbose: bool = True) -> tuple[int, int]:
    # Rebuild the table from scratch. The schema gained URL columns and made
    # `image` nullable, and create_all will not alter an existing table, so the
    # table is dropped and recreated rather than migrated. It is fully
    # regenerated on every run, so nothing is lost.
    SpeciesImage.__table__.drop(db.get_bind(), checkfirst=True)
    SpeciesImage.__table__.create(db.get_bind(), checkfirst=True)
    db.commit()

    n_dataset = _from_dataset(db)
    if verbose:
        print("      from local dataset: %d" % n_dataset, flush=True)

    n_wiki = _from_wikipedia(db, limit=wiki_limit)
    if verbose:
        print("      from wikipedia:     %d" % n_wiki, flush=True)

    return n_dataset, n_wiki
