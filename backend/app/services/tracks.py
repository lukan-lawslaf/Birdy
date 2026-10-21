"""Tracks as GeoJSON, at whatever resolution the caller can afford.

`movement_tracks` holds 742,755 fixes. Returning all of them for one species is
not useful to a map and would be megabytes of JSON, so the resolution parameter
thins server-side:

    daily   - every fix as stored (Movebank rows are already one per day)
    weekly  - one fix per individual per week
    monthly - one fix per individual per month

Thinning picks the *real* earliest fix in each bucket rather than averaging
coordinates, so every point on the map is a place the bird actually was. That
works because of a documented SQLite behaviour: when a query contains exactly
one `min()` or `max()` aggregate, the bare columns come from the row holding
that extreme — so `MIN(timestamp), latitude, longitude` returns the coordinates
of the earliest fix in each group, not an average.

If the requested resolution would still exceed the point cap it is coarsened
automatically, and the response reports the resolution that was actually used.
"""

from collections import OrderedDict
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MovementTrack, MovebankStudy

# Above this, a response is unwieldy for a browser map and the request is
# coarsened instead of served.
MAX_POINTS = 25_000

BUCKETS = {
    "daily": None,
    "weekly": "strftime('%Y-%W', timestamp)",
    "monthly": "substr(timestamp, 1, 7)",
}
ORDER = ["daily", "weekly", "monthly"]

_POINT_FILTER = (
    "latitude IS NOT NULL AND longitude IS NOT NULL AND timestamp IS NOT NULL"
)


def _line(coordinates: list[list[float]], properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "Feature",
        # GeoJSON mandates [longitude, latitude] — the opposite of how the data
        # is stored and how every map API is usually called.
        "geometry": {"type": "LineString", "coordinates": coordinates},
        "properties": properties,
    }


def _collection(features: list[dict[str, Any]]) -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": features}


async def _count(db: AsyncSession, where: str, params: dict) -> int:
    result = await db.execute(
        text(f"SELECT COUNT(*) FROM movement_tracks WHERE {where} AND {_POINT_FILTER}"), params
    )
    return int(result.scalar() or 0)


async def _fetch(db: AsyncSession, where: str, params: dict, resolution: str) -> list:
    bucket = BUCKETS[resolution]
    if bucket is None:
        # Daily is the stored grain — no grouping, so nothing is collapsed.
        sql = f"""
            SELECT individual_id, individual_local_identifier AS ident, timestamp AS ts,
                   latitude, longitude, source, study_id
              FROM movement_tracks
             WHERE {where} AND {_POINT_FILTER}
             ORDER BY individual_id, ts
        """
    else:
        sql = f"""
            SELECT individual_id, individual_local_identifier AS ident,
                   MIN(timestamp) AS ts,
                   latitude, longitude, source, study_id
              FROM movement_tracks
             WHERE {where} AND {_POINT_FILTER}
             GROUP BY individual_id, {bucket}
             ORDER BY individual_id, ts
        """
    return (await db.execute(text(sql), params)).mappings().all()


def _group(rows) -> list[dict[str, Any]]:
    """Rows -> one feature per individual, preserving order."""
    by_individual: OrderedDict[str, dict[str, Any]] = OrderedDict()
    for row in rows:
        key = row["individual_id"]
        entry = by_individual.setdefault(
            key,
            {
                "coordinates": [],
                "timestamps": [],
                "individual": row["ident"] or "unknown",
                "start": row["ts"],
                "end": row["ts"],
                "source": row["source"],
                "study_id": row["study_id"],
            },
        )
        entry["coordinates"].append([row["longitude"], row["latitude"]])
        entry["timestamps"].append(row["ts"])
        entry["end"] = row["ts"]
    return [
        _line(
            entry["coordinates"],
            {
                "individual": entry["individual"],
                "individual_id": key,
                "timestamps": entry["timestamps"],
                "points": len(entry["coordinates"]),
                "start": entry["start"],
                "end": entry["end"],
                "source": entry["source"],
                "study_id": entry["study_id"],
            },
        )
        for key, entry in by_individual.items()
    ]


async def individual_track(
    db: AsyncSession, individual_id: int, resolution: str = "daily"
) -> tuple[dict[str, Any], int, str]:
    """One bird's full journey, in time order."""
    resolution = resolution if resolution in BUCKETS else "daily"
    where = "individual_id = :iid"
    params = {"iid": individual_id}

    rows = await _fetch(db, where, params, resolution)
    if not rows and resolution != "daily":
        resolution = "daily"
        rows = await _fetch(db, where, params, resolution)

    features = _group(rows)
    if features:
        features[0]["properties"]["individual"] = features[0]["properties"]["individual"]
    return _collection(features), len(rows), resolution


async def species_tracks(
    db: AsyncSession,
    scientific_name: str,
    resolution: str = "monthly",
    max_points: int = MAX_POINTS,
    aliases: list[str] | None = None,
) -> tuple[dict[str, Any], int, int, str, str]:
    """Every tagged individual of a species, one polyline each.

    Returns (geojson, points, individuals, requested_resolution, used_resolution).
    """
    requested = resolution if resolution in BUCKETS else "monthly"
    names = aliases or [scientific_name]
    params = {f"name_{index}": name for index, name in enumerate(names)}
    where = "canonical_name IN (" + ", ".join(f":{key}" for key in params) + ")"

    used = requested
    for candidate in ORDER[ORDER.index(requested):]:
        if await _count(db, where, params) <= max_points or candidate == "monthly":
            used = candidate
            break

    rows = await _fetch(db, where, params, used)
    features = _group(rows)
    return _collection(features), len(rows), len(features), requested, used


async def studies_for_species(db: AsyncSession, scientific_name: str, aliases: list[str] | None = None) -> list[MovebankStudy]:
    """The studies behind a species' tracks — needed for required attribution."""
    study_ids = (await db.execute(
        select(MovementTrack.study_id)
        .where(MovementTrack.canonical_name.in_(aliases or [scientific_name]))
        .where(MovementTrack.study_id.isnot(None))
        .distinct()
    )).scalars().all()
    if not study_ids:
        return []
    return list((await db.execute(
        select(MovebankStudy).where(MovebankStudy.study_id.in_(study_ids))
    )).scalars().all())


async def studies_for_individual(db: AsyncSession, individual_id: int) -> list[MovebankStudy]:
    study_id = (await db.execute(
        select(MovementTrack.study_id).where(MovementTrack.individual_id == individual_id).limit(1)
    )).scalar_one_or_none()
    if not study_id:
        return []
    return list((await db.execute(
        select(MovebankStudy).where(MovebankStudy.study_id == study_id)
    )).scalars().all())


async def track_bounds(db: AsyncSession) -> dict[str, Any]:
    """Overall extent of all tracks — useful for setting a map's initial view."""
    row = (await db.execute(text("""
        SELECT MIN(latitude) AS south, MAX(latitude) AS north,
               MIN(longitude) AS west, MAX(longitude) AS east,
               MIN(timestamp) AS first_ts, MAX(timestamp) AS last_ts
          FROM movement_tracks
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    """))).mappings().first()
    return dict(row) if row else {}
