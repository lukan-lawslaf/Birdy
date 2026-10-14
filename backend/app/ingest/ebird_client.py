"""Pull seasonal bird data from the eBird API.

eBird has no "give me a species across the year" endpoint, so migration is
reconstructed by sampling the same day of each month in several flyway regions
and recording what was reported. Read the resulting curve across months and you
have when each species arrives, peaks and leaves.

Requires EBIRD_KEY (or eBird=) in the project .env.
"""

import time

import requests
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import settings
from app.ingest.sources import normalize_name
from app.models import EbirdHotspot, EbirdMigrationSample

REGIONS = [
    ("US-MA", "Massachusetts (Atlantic Flyway)"),
    ("US-TX", "Texas (Central Flyway)"),
    ("US-CA", "California (Pacific Flyway)"),
    ("US-IL", "Illinois (Mississippi Flyway)"),
    ("US-AK", "Alaska (Arctic breeding)"),
    ("GB", "United Kingdom (Europe-Africa Flyway)"),
]

YEAR = 2024
DAY = 15
MAX_RESULTS = 1000

# Species that also have a GBIF migration curve, so the two sources line up.
TARGET_SPECIES = [
    "Osprey",
    "Barn Swallow",
    "Sandhill Crane",
    "Snow Goose",
    "Ruby-throated Hummingbird",
    "Bar-tailed Godwit",
    "Whimbrel",
    "Red Knot",
    "Arctic Tern",
    "Common Cuckoo",
    "White Stork",
    "Northern Wheatear",
]
TARGET_KEYS = {normalize_name(n) for n in TARGET_SPECIES}


def _headers() -> dict:
    return {"X-eBirdApiToken": settings.ebird_key}


def _get(url: str, params: dict | None = None, tries: int = 3):
    for attempt in range(tries):
        try:
            r = requests.get(url, headers=_headers(), params=params, timeout=45)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (403, 401):
                raise RuntimeError(f"eBird rejected the key (HTTP {r.status_code})")
            time.sleep(1.5 * (attempt + 1))
        except RuntimeError:
            raise
        except Exception:
            if attempt == tries - 1:
                return None
            time.sleep(1.5 * (attempt + 1))
    return None


def fetch_historic(region: str, year: int, month: int, day: int) -> list[dict] | None:
    return _get(
        f"{settings.ebird_base_url}/data/obs/{region}/historic/{year}/{month}/{day}",
        {"maxResults": MAX_RESULTS},
    )


def fetch_hotspots(region: str) -> list[dict] | None:
    return _get(f"{settings.ebird_base_url}/ref/hotspot/{region}", {"fmt": "json"})


def count_by_species(observations: list[dict]) -> dict[tuple[str, str, str], int]:
    """Collapse a day of observations to {species: number of records}."""
    counts: dict[tuple[str, str, str], int] = {}
    for obs in observations:
        key = (obs.get("speciesCode"), obs.get("comName"), obs.get("sciName"))
        counts[key] = counts.get(key, 0) + 1
    return counts


def load_ebird(db: Session, verbose: bool = True) -> tuple[int, int]:
    if not settings.ebird_enabled:
        raise RuntimeError("no eBird key configured in .env")

    db.execute(delete(EbirdMigrationSample))
    db.execute(delete(EbirdHotspot))
    db.commit()

    samples: list[dict] = []
    delay = settings.ebird_request_delay_seconds

    for region_code, region_name in REGIONS:
        for month in range(1, 13):
            records = fetch_historic(region_code, YEAR, month, DAY)
            if records is None:
                if verbose:
                    print("      %s %02d: fetch failed" % (region_code, month), flush=True)
                continue
            total = len(records)
            counts = count_by_species(records)
            for (code, com, sci), n in counts.items():
                samples.append({
                    "region_code": region_code,
                    "region_name": region_name,
                    "year": YEAR,
                    "month": month,
                    "day": DAY,
                    "species_code": code,
                    "common_name": com,
                    "scientific_name": sci,
                    "observation_count": n,
                    "is_target": 1 if normalize_name(com) in TARGET_KEYS else 0,
                    "region_total_records": total,
                })
            if verbose:
                print("      %s %02d: %d records, %d species" % (region_code, month, total, len(counts)), flush=True)
            time.sleep(delay)

    for i in range(0, len(samples), 2000):
        db.bulk_insert_mappings(EbirdMigrationSample, samples[i : i + 2000])
    db.commit()

    hotspots: list[dict] = []
    for region_code, _ in REGIONS:
        data = fetch_hotspots(region_code) or []
        for h in data:
            hotspots.append({
                "region_code": region_code,
                "loc_id": h.get("locId"),
                "name": h.get("locName"),
                "latitude": h.get("lat"),
                "longitude": h.get("lng"),
                "latest_obs_dt": h.get("latestObsDt"),
                "num_species_all_time": h.get("numSpeciesAllTime"),
            })
        if verbose:
            print("      %s hotspots: %d" % (region_code, len(data)), flush=True)
        time.sleep(delay)

    for i in range(0, len(hotspots), 2000):
        db.bulk_insert_mappings(EbirdHotspot, hotspots[i : i + 2000])
    db.commit()
    return len(samples), len(hotspots)
