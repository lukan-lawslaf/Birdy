"""The eBird taxonomic backbone — 16,753 names, the authority for joins."""

from fastapi import APIRouter, Query
from sqlalchemy import distinct, func, select

from app.models import Taxonomy
from app.routers.deps import DbDep, PageQuery, PageSizeQuery, not_found, paginated
from app.schemas import FamilyNode, OrderNode, Page, TaxonomyCategory, TaxonomyOut

router = APIRouter(prefix="/taxonomy", tags=["taxonomy"])


@router.get("/orders", response_model=list[OrderNode])
async def orders(db: DbDep, category: str = Query("species")):
    """Orders with their species count and family list — a browse tree's top level."""
    rows = (
        await db.execute(
            select(Taxonomy.order_name, Taxonomy.family, func.count())
            .where(Taxonomy.category == category)
            .where(Taxonomy.order_name.isnot(None))
            .group_by(Taxonomy.order_name, Taxonomy.family)
            .order_by(Taxonomy.order_name)
        )
    ).all()

    grouped: dict[str, OrderNode] = {}
    for order_name, family, count in rows:
        node = grouped.setdefault(order_name, OrderNode(order_name=order_name, species_count=0))
        node.species_count += count
        if family and family not in node.families:
            node.families.append(family)
    return list(grouped.values())


@router.get("/families", response_model=list[FamilyNode])
async def families(db: DbDep, order: str | None = None, category: str = Query("species")):
    stmt = (
        select(Taxonomy.family, Taxonomy.order_name, func.count())
        .where(Taxonomy.category == category)
        .where(Taxonomy.family.isnot(None))
        .group_by(Taxonomy.family, Taxonomy.order_name)
        .order_by(Taxonomy.family)
    )
    if order:
        stmt = stmt.where(Taxonomy.order_name == order)
    rows = (await db.execute(stmt)).all()
    return [
        FamilyNode(family=family, species_count=count or 0, order_name=order_name)
        for family, order_name, count in rows
    ]


@router.get("/search", response_model=Page[TaxonomyOut])
async def search(
    db: DbDep,
    q: str = Query(..., min_length=1),
    category: str | None = None,
    page: PageQuery = 1,
    page_size: PageSizeQuery = 25,
):
    """Raw backbone rows, including subspecies and hybrids — unlike /species,
    which lists full species only."""
    pattern = f"%{q}%"
    condition = Taxonomy.sci_name.ilike(pattern) | Taxonomy.primary_com_name.ilike(pattern)
    stmt = select(Taxonomy).where(condition)
    count_stmt = select(func.count()).select_from(Taxonomy).where(condition)
    if category:
        stmt = stmt.where(Taxonomy.category == category)
        count_stmt = count_stmt.where(Taxonomy.category == category)

    total = (await db.execute(count_stmt)).scalar() or 0
    rows = (
        await db.execute(
            stmt.order_by(Taxonomy.taxon_order).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()
    return paginated(total, page, page_size, [TaxonomyOut.model_validate(r) for r in rows])


@router.get("/categories", response_model=list[TaxonomyCategory])
async def categories(db: DbDep):
    """What kinds of rows the backbone holds — species, subspecies, hybrids,
    spuh and the rest — with counts."""
    rows = (
        await db.execute(
            select(Taxonomy.category, func.count()).group_by(Taxonomy.category).order_by(func.count().desc())
        )
    ).all()
    return [TaxonomyCategory(category=c, rows=n) for c, n in rows]


@router.get("/{sci_name}", response_model=TaxonomyOut)
async def taxon(sci_name: str, db: DbDep):
    row = (
        await db.execute(
            select(Taxonomy).where(func.lower(Taxonomy.sci_name) == sci_name.lower()).limit(1)
        )
    ).scalars().first()
    if row is None:
        raise not_found("taxon", sci_name)
    return TaxonomyOut.model_validate(row)
