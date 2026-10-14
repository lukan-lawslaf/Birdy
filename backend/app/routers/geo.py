"""Global species richness — the AVONET equal-area grid, 18,421 land cells.

The source table carries only a `WorldID` and three counts, so the ingest
pipeline joins in each cell's location from two companion files in the same
archive: the Behrmann grid shapefile for the cell centre, and a cell-to-country
table for the name. Every one of the 18,421 cells came out with both.

The result is a genuine map layer. The highest-richness cells are all in the
Andes and Amazon — Ecuador, Colombia, Peru, Bolivia — and the countries with the
highest mean richness are Guyana, Suriname, Uganda and Colombia, which is where
the world's birds actually are. That makes the coordinates self-checking.
"""

from fastapi import APIRouter, Query
from sqlalchemy import func, select, text

from app.models import RichnessCell
from app.routers.deps import DbDep, PageQuery, PageSizeQuery, paginated
from app.schemas import (
    CountryRichness,
    GeoJSONFeatureCollection,
    Page,
    RichnessCellOut,
    RichnessSummary,
)

router = APIRouter(prefix="/geo", tags=["geo"])

# Above this a world map becomes unreadable anyway, so the default keeps the
# response small while the cap leaves room for a zoomed-in region.
DEFAULT_MAP_CELLS = 5000
MAX_MAP_CELLS = 20000


def _conditions(
    min_species: int | None,
    max_species: int | None,
    country: str | None,
    north: float | None = None,
    south: float | None = None,
    east: float | None = None,
    west: float | None = None,
):
    conditions = []
    if min_species is not None:
        conditions.append(RichnessCell.total_richness >= min_species)
    if max_species is not None:
        conditions.append(RichnessCell.total_richness <= max_species)
    if country:
        conditions.append(RichnessCell.country == country)
    if north is not None:
        conditions.append(RichnessCell.latitude <= north)
    if south is not None:
        conditions.append(RichnessCell.latitude >= south)
    if east is not None:
        conditions.append(RichnessCell.longitude <= east)
    if west is not None:
        conditions.append(RichnessCell.longitude >= west)
    return conditions


# Literal paths first: /richness/geojson must not be read as a richness cell.


@router.get("/richness/geojson", response_model=GeoJSONFeatureCollection)
async def richness_geojson(
    db: DbDep,
    min_species: int | None = Query(None, ge=0, description="Only cells at least this rich"),
    country: str | None = None,
    north: float | None = Query(None, ge=-90, le=90),
    south: float | None = Query(None, ge=-90, le=90),
    east: float | None = Query(None, ge=-180, le=180),
    west: float | None = Query(None, ge=-180, le=180),
    limit: int = Query(DEFAULT_MAP_CELLS, ge=1, le=MAX_MAP_CELLS),
):
    """The grid as point features — one per cell, coloured by richness.

    Each feature is the cell's centre, so a client can draw a heatmap or size
    each point by `total_richness`.
    """
    conditions = _conditions(min_species, None, country, north, south, east, west)
    conditions.append(RichnessCell.latitude.isnot(None))
    rows = (
        await db.execute(
            select(RichnessCell)
            .where(*conditions)
            .order_by(RichnessCell.total_richness.desc())
            .limit(limit)
        )
    ).scalars().all()

    return GeoJSONFeatureCollection(
        features=[
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r.longitude, r.latitude]},
                "properties": {
                    "world_id": r.world_id,
                    "country": r.country,
                    "total_richness": r.total_richness,
                    "sampled_richness": r.sampled_richness,
                    "unsampled_richness": r.unsampled_richness,
                },
            }
            for r in rows
        ]
    )


@router.get("/richness/summary", response_model=RichnessSummary)
async def richness_summary(db: DbDep):
    """Headline numbers and a histogram of species-per-cell.

    The histogram is the interesting part: most land cells hold few species and
    a small tropical tail holds hundreds, which is the shape you would expect.
    """
    stats = (
        await db.execute(
            select(
                func.count(),
                func.max(RichnessCell.total_richness),
                func.min(RichnessCell.total_richness),
                func.avg(RichnessCell.total_richness),
            )
        )
    ).first()
    located = (
        await db.execute(
            select(func.count()).select_from(RichnessCell).where(RichnessCell.latitude.isnot(None))
        )
    ).scalar() or 0

    buckets = (
        await db.execute(
            text(
                "SELECT (total_richness / 50) * 50 AS bucket_start, COUNT(*) AS cells "
                "  FROM richness_cells "
                " WHERE total_richness IS NOT NULL "
                " GROUP BY bucket_start ORDER BY bucket_start"
            )
        )
    ).all()

    return RichnessSummary(
        cells=stats[0] or 0,
        cells_with_location=located,
        max_total_richness=stats[1],
        min_total_richness=stats[2],
        mean_total_richness=round(stats[3], 2) if stats[3] is not None else None,
        histogram=[
            {"bucket_start": start, "bucket_end": start + 49, "cells": cells}
            for start, cells in buckets
        ],
    )


@router.get("/countries", response_model=list[CountryRichness])
async def countries(
    db: DbDep,
    min_cells: int = Query(1, ge=1, description="Skip countries with fewer cells than this"),
    limit: int = Query(100, ge=1, le=300),
):
    """Richness rolled up by country — the ranked table beside the map.

    Averaged per cell rather than totalled, because a large country has more
    cells and would otherwise always win.
    """
    rows = (
        await db.execute(
            select(
                RichnessCell.country,
                func.count(),
                func.avg(RichnessCell.total_richness),
                func.max(RichnessCell.total_richness),
                func.sum(RichnessCell.total_richness),
            )
            .where(RichnessCell.country.isnot(None))
            .group_by(RichnessCell.country)
            .having(func.count() >= min_cells)
            .order_by(func.avg(RichnessCell.total_richness).desc())
            .limit(limit)
        )
    ).all()
    return [
        CountryRichness(
            country=name,
            cells=cells,
            mean_richness=round(mean or 0, 1),
            max_richness=peak,
            total_richness=total,
        )
        for name, cells, mean, peak, total in rows
    ]


@router.get("/richness", response_model=Page[RichnessCellOut])
async def richness_cells(
    db: DbDep,
    min_species: int | None = Query(None, ge=0, description="Only cells with at least this many species"),
    max_species: int | None = Query(None, ge=0),
    country: str | None = None,
    page: PageQuery = 1,
    page_size: PageSizeQuery = 100,
):
    conditions = _conditions(min_species, max_species, country)
    total = (
        await db.execute(select(func.count()).select_from(RichnessCell).where(*conditions))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(RichnessCell)
            .where(*conditions)
            .order_by(RichnessCell.total_richness.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return paginated(total, page, page_size, [RichnessCellOut.model_validate(r) for r in rows])
