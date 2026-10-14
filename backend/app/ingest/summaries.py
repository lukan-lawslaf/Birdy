"""Short species descriptions from the Wikipedia REST summary endpoint.

Only the species people actually look up get a stored description — the top
250 by how often they appear in our own data (eBird presence samples plus the
observation file). Every other species still has its Wikipedia page URL in
`species_images`, so a "read on Wikipedia" link works without stored text; this
just avoids 11,000 requests and a table nobody reads.

One request per species:

    GET https://en.wikipedia.org/api/rest_v1/page/summary/<scientific name>

which returns the plain-text lead (a few sentences), the canonical Wikipedia
page URL, and a thumbnail URL. The older `action=query&prop=extracts` route no
longer returns anything on en.wikipedia, so this is the one that works.
"""

import time
from concurrent.futures import ThreadPoolExecutor

import requests
from sqlalchemy import delete, insert, text
from sqlalchemy.orm import Session

from app.models import SpeciesSummary

SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/"
# Wikimedia rate-limits clients whose User-Agent carries no contact. A bare
# "bird-atlas/0.1" UA got 429 on most requests; adding a contact string dropped
# that to zero at the same concurrency. Replace the contact with your own.
UA = {
    "User-Agent": "bird-atlas/0.1 (educational bird data project; contact: bird-atlas@example.org)",
    "Accept": "application/json",
}
WORKERS = 6
RETRIES = 4
CHUNK = 100
TOP_N = 250

# How common a species is, by our own evidence: how many region-months it was
# reported in (eBird presence samples) plus how many times it was observed in
# the Alabama sample. Reported in many places, many times = a bird people see.
RANKING_SQL = """
SELECT scientific_name, SUM(n) AS score FROM (
    SELECT scientific_name, COUNT(*) AS n
      FROM ebird_migration_samples
     WHERE scientific_name IS NOT NULL AND scientific_name <> ''
     GROUP BY scientific_name
    UNION ALL
    SELECT scientific_name, COUNT(*) AS n
      FROM observations
     WHERE scientific_name IS NOT NULL AND scientific_name <> ''
     GROUP BY scientific_name
) GROUP BY scientific_name
ORDER BY score DESC, scientific_name ASC
"""


def ranked_species(db: Session, top_n: int | None = TOP_N) -> list[str]:
    """Scientific names ordered by how common they are in our own data."""
    names = [row[0] for row in db.execute(text(RANKING_SQL)).all()]
    return names[:top_n] if top_n else names


def _fetch(scientific_name: str) -> dict | None:
    """One species' summary, or None if Wikipedia has no usable page for it."""
    title = requests.utils.quote(scientific_name.replace(" ", "_"), safe="")
    for attempt in range(RETRIES):
        try:
            r = requests.get(SUMMARY_URL + title, headers=UA, timeout=30)
            if r.status_code == 404:
                return None  # no page under that name
            if r.status_code == 429 or r.status_code >= 500:
                retry_after = r.headers.get("Retry-After")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else 2.0 * (attempt + 1)
                time.sleep(wait)
                continue
            r.raise_for_status()
            j = r.json()
            if j.get("type") == "disambiguation":
                return None
            extract = (j.get("extract") or "").strip()
            if not extract:
                return None
            return {
                "scientific_name": scientific_name,
                "title": j.get("title"),
                "summary": extract,
                "wikipedia_url": ((j.get("content_urls") or {}).get("desktop") or {}).get("page"),
                "thumbnail_url": (j.get("thumbnail") or {}).get("source"),
                "source": "wikipedia",
            }
        except Exception:
            time.sleep(2.0 * (attempt + 1))
    return None


def load_species_summaries(
    db: Session, top_n: int | None = TOP_N, verbose: bool = True
) -> int:
    """Store summaries for the top_n most common species. Clears the table
    first, so re-running replaces rather than accumulates."""
    db.execute(delete(SpeciesSummary))
    db.commit()

    names = ranked_species(db, top_n)

    if verbose:
        print("      %d species to summarise (top %s by our own records)"
              % (len(names), top_n if top_n else "all"), flush=True)

    stored = 0
    for i in range(0, len(names), CHUNK):
        chunk = names[i : i + CHUNK]
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            rows = [r for r in pool.map(_fetch, chunk) if r]
        if rows:
            db.execute(insert(SpeciesSummary), rows)
            db.commit()
            stored += len(rows)
        if verbose:
            print("      %d stored; %d of %d checked"
                  % (stored, min(i + CHUNK, len(names)), len(names)), flush=True)

    return stored
