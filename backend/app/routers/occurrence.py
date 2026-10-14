"""Where and when birds were recorded — three different sources, three views.

`gbif_occurrences`      global museum and survey records, balanced across the year
`gbif_migration_summary` per-species monthly totals — the migration curve
`ebird_migration_samples` presence per region-month, sampled live from the API
`ebird_hotspots`        birding locations per region
`observations`          the raw eBird Basic Dataset sample (one Alabama county)
"""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select, text

from app.models import (
    EbirdHotspot,
    EbirdMigrationSample,
    GbifMigrationSummary,
    GbifOccurrence,
    Observation,
)
from app.routers.deps import DbDep, PageQuery, PageSizeQuery, paginated
from app.schemas import (
    EbirdRegion,
    EbirdSampleOut,
    EbirdTimeline,
    GeoJSONFeatureCollection,
    GbifPointOut,
    HotspotOut,
    MigrationCurve,
    ObservationOut,
    Page,
    SampledConditions,
)
from app.services import resolve

router = APIRouter(prefix="/occurrence", tags=["occurrence"])


def _curve(row: GbifMigrationSummary) -> MigrationCurve:
    return MigrationCurve(
        common_name=row.common_name,
        scientific_name=row.scientific_name,
        gbif_key=row.gbif_key,
        peak_month=row.peak_month,
        georeferenced_records=row.georeferenced_records,
        top_countries=[c.strip() for c in (row.top_countries or "").split(",") if c.strip()],
        months=[getattr(row, f"month_{m:02d}") or 0 for m in range(1, 13)],
    )


# ------------------------------------------------------------------ migration


@router.get("/migration", response_model=list[MigrationCurve])
async def migration_curves(db: DbDep):
    """Every species with a monthly curve — twelve of them.

    This is the abundance view. eBird's endpoint cannot supply it (see
    /occurrence/ebird), so these GBIF totals are the ones that carry counts.
    """
    rows = (await db.execute(select(GbifMigrationSummary).order_by(GbifMigrationSummary.common_name))).scalars().all()
    return [_curve(r) for r in rows]


@router.get("/migration/compare", response_model=list[MigrationCurve])
async def migration_compare(
    db: DbDep,
    names: list[str] = Query(..., description="Repeat for each species to overlay"),
):
    """Several curves at once, for an overlaid chart.

    The interesting comparison is the contrast — Barn Swallow and Snow Goose
    peak in opposite halves of the year, because one winters where the other
    breeds.
    """
    if len(names) > 12:
        raise HTTPException(status_code=400, detail="At most 12 species per comparison")
    folded = [resolve.fold(n) for n in names]
    rows = (await db.execute(select(GbifMigrationSummary))).scalars().all()
    picked = [
        r for r in rows
        if resolve.fold(r.common_name) in folded or resolve.fold(r.scientific_name) in folded
    ]
    if not picked:
        raise HTTPException(status_code=404, detail="None of those names have a migration curve")
    return [_curve(r) for r in picked]


@router.get("/migration/{name}", response_model=MigrationCurve)
async def migration_curve(name: str, db: DbDep):
    folded = resolve.fold(name)
    rows = (await db.execute(select(GbifMigrationSummary))).scalars().all()
    match = next(
        (r for r in rows if folded in (resolve.fold(r.common_name), resolve.fold(r.scientific_name))),
        None,
    )
    if match is None:
        raise HTTPException(
            status_code=404,
            detail=f"No migration curve for '{name}' (only 12 species were sampled from GBIF)",
        )
    return _curve(match)


# ------------------------------------------------------------------ gbif points


def _point_conditions(scientific_name, common_name, month, country, year):
    conditions = [
        GbifOccurrence.latitude.isnot(None),
        GbifOccurrence.longitude.isnot(None),
    ]
    if scientific_name:
        conditions.append(GbifOccurrence.scientific_name == scientific_name)
    if common_name:
        conditions.append(GbifOccurrence.common_name == common_name)
    if month:
        conditions.append(GbifOccurrence.month == month)
    if year:
        conditions.append(GbifOccurrence.year == year)
    if country:
        conditions.append(GbifOccurrence.country == country)
    return conditions


@router.get("/points", response_model=Page[GbifPointOut])
async def gbif_points(
    db: DbDep,
    common_name: str | None = None,
    scientific_name: str | None = None,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = None,
    country: str | None = None,
    page: PageQuery = 1,
    page_size: PageSizeQuery = 100,
):
    conditions = _point_conditions(scientific_name, common_name, month, country, year)
    total = (
        await db.execute(select(func.count()).select_from(GbifOccurrence).where(*conditions))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(GbifOccurrence)
            .where(*conditions)
            .order_by(GbifOccurrence.common_name, GbifOccurrence.month)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return paginated(total, page, page_size, [GbifPointOut.model_validate(r) for r in rows])


@router.get("/points/geojson", response_model=GeoJSONFeatureCollection)
async def gbif_points_geojson(
    db: DbDep,
    common_name: str | None = None,
    scientific_name: str | None = None,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = None,
    country: str | None = None,
    limit: int = Query(20000, ge=1, le=50000),
):
    """The same records as `/points`, shaped for a map layer."""
    conditions = _point_conditions(scientific_name, common_name, month, country, year)
    rows = (
        await db.execute(select(GbifOccurrence).where(*conditions).limit(limit))
    ).scalars().all()
    return GeoJSONFeatureCollection(
        features=[
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r.longitude, r.latitude]},
                "properties": {
                    "common_name": r.common_name,
                    "month": r.month,
                    "year": r.year,
                    "country": r.country,
                    "country_code": r.country_code,
                    "basis_of_record": r.basis_of_record,
                },
            }
            for r in rows
        ]
    )


# ------------------------------------------------------------------ ebird


@router.get("/ebird/regions", response_model=list[EbirdRegion])
async def ebird_regions(db: DbDep, year: int | None = None):
    """The sampled regions, with how much of the year each covers."""
    stmt = (
        select(
            EbirdMigrationSample.region_code,
            EbirdMigrationSample.region_name,
            func.count(func.distinct(EbirdMigrationSample.scientific_name)),
        )
        .group_by(EbirdMigrationSample.region_code, EbirdMigrationSample.region_name)
        .order_by(EbirdMigrationSample.region_code)
    )
    if year:
        stmt = stmt.where(EbirdMigrationSample.year == year)
    rows = (await db.execute(stmt)).all()

    months_stmt = (
        select(EbirdMigrationSample.region_code, EbirdMigrationSample.month)
        .distinct()
        .order_by(EbirdMigrationSample.region_code, EbirdMigrationSample.month)
    )
    if year:
        months_stmt = months_stmt.where(EbirdMigrationSample.year == year)
    months: dict[str, list[int]] = {}
    for code, month in (await db.execute(months_stmt)).all():
        months.setdefault(code, []).append(month)

    return [
        EbirdRegion(
            region_code=code,
            region_name=name,
            species_reported=count or 0,
            months_covered=months.get(code, []),
        )
        for code, name, count in rows
    ]


@router.get("/ebird/timeline", response_model=EbirdTimeline)
async def ebird_timeline(
    db: DbDep,
    name: str = Query(..., description="Scientific or common name"),
    year: int = Query(2024),
):
    """One species across every region-month — a seasonal presence matrix.

    Each cell counts *reports*, not birds: the eBird historic endpoint returns
    at most one record per species per day, so this shows whether the species
    was seen, not how many were there. Use the GBIF curves for abundance.
    """
    resolved = await resolve.resolve_species(db, name)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"No species found matching '{name}'")

    rows = (
        await db.execute(
            select(
                EbirdMigrationSample.region_code,
                EbirdMigrationSample.region_name,
                EbirdMigrationSample.month,
                func.count().label("n"),
            )
            .where(EbirdMigrationSample.scientific_name == resolved.scientific_name)
            .where(EbirdMigrationSample.year == year)
            .group_by(
                EbirdMigrationSample.region_code,
                EbirdMigrationSample.region_name,
                EbirdMigrationSample.month,
            )
            .order_by(EbirdMigrationSample.region_code, EbirdMigrationSample.month)
        )
    ).all()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"'{resolved.scientific_name}' was not reported in any sampled region in {year}",
        )

    months = sorted({r[2] for r in rows})
    grouped: dict[str, dict] = {}
    for code, region_name, month, count in rows:
        entry = grouped.setdefault(code, {"region_code": code, "region_name": region_name, "months": {}})
        entry["months"][month] = count

    return EbirdTimeline(
        scientific_name=resolved.scientific_name,
        common_name=resolved.common_name,
        year=year,
        months=months,
        regions=list(grouped.values()),
    )


@router.get("/ebird", response_model=Page[EbirdSampleOut])
async def ebird_samples(
    db: DbDep,
    region_code: str | None = None,
    scientific_name: str | None = None,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = None,
    page: PageQuery = 1,
    page_size: PageSizeQuery = 100,
):
    conditions = []
    if region_code:
        conditions.append(EbirdMigrationSample.region_code == region_code)
    if scientific_name:
        conditions.append(EbirdMigrationSample.scientific_name == scientific_name)
    if month:
        conditions.append(EbirdMigrationSample.month == month)
    if year:
        conditions.append(EbirdMigrationSample.year == year)

    total = (
        await db.execute(select(func.count()).select_from(EbirdMigrationSample).where(*conditions))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(EbirdMigrationSample)
            .where(*conditions)
            .order_by(
                EbirdMigrationSample.region_code,
                EbirdMigrationSample.month,
                EbirdMigrationSample.common_name,
            )
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return paginated(total, page, page_size, [EbirdSampleOut.model_validate(r) for r in rows])


@router.get("/hotspots", response_model=Page[HotspotOut])
async def hotspots(
    db: DbDep,
    region_code: str | None = None,
    min_species: int | None = Query(None, ge=0),
    page: PageQuery = 1,
    page_size: PageSizeQuery = 100,
):
    conditions = [EbirdHotspot.latitude.isnot(None), EbirdHotspot.longitude.isnot(None)]
    if region_code:
        conditions.append(EbirdHotspot.region_code == region_code)
    if min_species:
        conditions.append(EbirdHotspot.num_species_all_time >= min_species)

    total = (
        await db.execute(select(func.count()).select_from(EbirdHotspot).where(*conditions))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(EbirdHotspot)
            .where(*conditions)
            .order_by(EbirdHotspot.num_species_all_time.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return paginated(total, page, page_size, [HotspotOut.model_validate(r) for r in rows])


@router.get("/hotspots/geojson", response_model=GeoJSONFeatureCollection)
async def hotspots_geojson(
    db: DbDep,
    region_code: str | None = None,
    limit: int = Query(20000, ge=1, le=60000),
):
    conditions = [EbirdHotspot.latitude.isnot(None), EbirdHotspot.longitude.isnot(None)]
    if region_code:
        conditions.append(EbirdHotspot.region_code == region_code)
    rows = (await db.execute(select(EbirdHotspot).where(*conditions).limit(limit))).scalars().all()
    return GeoJSONFeatureCollection(
        features=[
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r.longitude, r.latitude]},
                "properties": {
                    "name": r.name,
                    "loc_id": r.loc_id,
                    "region_code": r.region_code,
                    "num_species_all_time": r.num_species_all_time,
                    "latest_obs_dt": r.latest_obs_dt,
                },
            }
            for r in rows
        ]
    )


# ------------------------------------------------------------------ raw sample


@router.get("/observations", response_model=Page[ObservationOut])
async def observations(
    db: DbDep,
    common_name: str | None = None,
    date: str | None = Query(None, description="YYYY-MM-DD"),
    county: str | None = None,
    page: PageQuery = 1,
    page_size: PageSizeQuery = 100,
):
    """The raw eBird Basic Dataset rows — the underlying checklists."""
    conditions = []
    if common_name:
        conditions.append(Observation.common_name.ilike(f"%{common_name}%"))
    if date:
        conditions.append(Observation.observation_date == date)
    if county:
        conditions.append(Observation.county.ilike(f"%{county}%"))

    total = (
        await db.execute(select(func.count()).select_from(Observation).where(*conditions))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(Observation)
            .where(*conditions)
            .order_by(Observation.observation_date, Observation.taxonomic_order)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return paginated(total, page, page_size, [ObservationOut.model_validate(r) for r in rows])


@router.get("/conditions", response_model=SampledConditions)
async def sampled_conditions(db: DbDep):
    """What the occurrence tables actually cover, so charts can be labelled."""
    row = (
        await db.execute(
            text(
                "SELECT (SELECT COUNT(*) FROM gbif_occurrences)   AS gbif_points, "
                "       (SELECT COUNT(DISTINCT common_name) FROM gbif_occurrences) AS gbif_species, "
                "       (SELECT COUNT(*) FROM gbif_migration_summary) AS gbif_curves, "
                "       (SELECT COUNT(*) FROM ebird_migration_samples) AS ebird_samples, "
                "       (SELECT COUNT(DISTINCT region_code) FROM ebird_migration_samples) AS ebird_regions, "
                "       (SELECT MIN(year) FROM ebird_migration_samples) AS ebird_year_min, "
                "       (SELECT MAX(year) FROM ebird_migration_samples) AS ebird_year_max, "
                "       (SELECT COUNT(*) FROM ebird_hotspots) AS hotspots, "
                "       (SELECT COUNT(*) FROM observations)  AS observations"
            )
        )
    ).mappings().first()
    return SampledConditions(**dict(row or {}))
