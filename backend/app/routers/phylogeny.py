"""The BirdLife family tree and the Hackett species tree.

`phylogeny_families` holds 483 nodes — 243 named families plus the unnamed
internal clades, stored as `clade_<n>` so the topology stays navigable.
`phylogeny_species` is the 6,670-tip species-level tree.
"""

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.models import PhylogenyFamily, PhylogenySpecies
from app.routers.deps import DbDep, PageQuery, PageSizeQuery, not_found, paginated
from app.schemas import Page, PhylogenyFamilyOut, PhylogenyNode, TreeMembership

router = APIRouter(prefix="/phylogeny", tags=["phylogeny"])


@router.get("/families", response_model=list[PhylogenyFamilyOut])
async def families(db: DbDep, named_only: bool = Query(True, description="Only the 243 real families")):
    """Flat node list, with each node's parent, for a client that builds its own tree."""
    stmt = select(PhylogenyFamily).order_by(PhylogenyFamily.name)
    if named_only:
        stmt = stmt.where(PhylogenyFamily.is_family == 1)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        PhylogenyFamilyOut(
            name=r.name, parent_name=r.parent_name, is_family=bool(r.is_family)
        )
        for r in rows
    ]


@router.get("/tree", response_model=list[PhylogenyNode])
async def tree(db: DbDep, named_only: bool = Query(False)):
    """The whole tree, nested, ready to render.

    Built in one pass and returned as roots — 483 nodes is small enough that
    nesting it here saves the client from doing it.
    """
    stmt = select(PhylogenyFamily)
    if named_only:
        stmt = stmt.where(PhylogenyFamily.is_family == 1)
    rows = (await db.execute(stmt)).scalars().all()

    nodes = {r.name: PhylogenyNode(name=r.name, is_family=bool(r.is_family)) for r in rows}
    included = set(nodes)
    roots: list[PhylogenyNode] = []
    for r in rows:
        # A parent outside the filtered set (an unnamed clade, when named_only)
        # makes its child a root rather than orphaning it.
        if r.parent_name and r.parent_name in included and r.parent_name != r.name:
            nodes[r.parent_name].children.append(nodes[r.name])
        else:
            roots.append(nodes[r.name])
    return roots


@router.get("/species", response_model=Page[str])
async def species_tips(
    db: DbDep,
    q: str | None = None,
    page: PageQuery = 1,
    page_size: PageSizeQuery = 100,
):
    """The 6,670 species-level tips of the Hackett tree."""
    stmt = select(PhylogenySpecies)
    count_stmt = select(func.count()).select_from(PhylogenySpecies)
    if q:
        condition = PhylogenySpecies.scientific_name.ilike(f"%{q}%")
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    total = (await db.execute(count_stmt)).scalar() or 0
    rows = (
        await db.execute(
            stmt.order_by(PhylogenySpecies.scientific_name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return paginated(total, page, page_size, [r.scientific_name for r in rows])


@router.get("/species/{sci_name}", response_model=TreeMembership)
async def is_in_tree(sci_name: str, db: DbDep):
    """Whether a species is a tip of the tree — the frontend's cue to show a
    phylogeny tab."""
    row = (
        await db.execute(
            select(PhylogenySpecies).where(
                func.lower(PhylogenySpecies.scientific_name) == sci_name.lower()
            )
        )
    ).scalars().first()
    if row is None:
        raise not_found("species in the Hackett tree", sci_name)
    return TreeMembership(scientific_name=row.scientific_name)
