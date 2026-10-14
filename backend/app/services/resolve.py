"""Turn whatever a client asks for into one species, across six name sets.

There is no single species table. Traits, conservation, taxonomy, the image
dataset and the image/summary tables each have their own list, and they do not
agree on membership: AVONET covers ~11,000 species, BirdLife ~11,185, eBird's
backbone 16,753 including subspecies, and the classifier only 526. Common names
are worse — the same bird is "Northern Flicker" in eBird, "NORTHERN FLICKER" in
the image dataset, and may be spelled with or without a hyphen elsewhere.

So the API takes either a scientific or a common name, in any casing, and walks
a cascade from most to least authoritative. Whatever it lands on becomes the
canonical scientific name for the rest of the request.
"""

import re
import unicodedata
from dataclasses import dataclass, field

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Conservation, Species, SpeciesImage, Taxonomy, Trait


def fold(value: str | None) -> str:
    """Fold a name for comparison: strip accents, drop everything but letters.

    "Black-billed Cuckoo", "BLACK BILLED CUCKOO" and "blackbilledcuckoo" all
    collapse to the same key, which is what makes the image dataset's all-caps
    typo-ridden names matchable at all.
    """
    if not value:
        return ""
    ascii_only = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", ascii_only.lower())


@dataclass
class Resolved:
    """A species, however we managed to identify it."""

    scientific_name: str
    common_name: str | None = None
    matched_on: str | None = None
    label_indices: list[int] = field(default_factory=list)


async def _one(db: AsyncSession, stmt):
    return (await db.execute(stmt)).scalars().first()


async def resolve_species(db: AsyncSession, name: str) -> Resolved | None:
    """Find one species from a scientific or common name, or return None.

    Cascade, in order: exact scientific name in the eBird backbone (the
    authority the rest of the project keys on), then eBird common name, then
    AVONET, then BirdLife, then the image dataset's uppercase names, then the
    image table. A folded comparison catches case and punctuation differences;
    a prefix scan is the last resort and only accepted if it is unambiguous.
    """
    if not name or not name.strip():
        return None
    raw = name.strip()
    folded = fold(raw)

    # 1. eBird backbone by scientific name — the canonical authority.
    row = await _one(db, select(Taxonomy).where(func.lower(Taxonomy.sci_name) == raw.lower()))
    if row and row.sci_name:
        return Resolved(row.sci_name, row.primary_com_name, "taxonomy.scientific_name")

    # 2. eBird backbone by common name.
    row = await _one(
        db, select(Taxonomy).where(func.lower(Taxonomy.primary_com_name) == raw.lower())
    )
    if row and row.sci_name:
        return Resolved(row.sci_name, row.primary_com_name, "taxonomy.common_name")

    # 3-6. Everything else keys on the scientific name, so look for the species
    #      there but return the nicest common name we can find for it.
    for model, sci_col, com_col, label in (
        (Trait, Trait.scientific_name, None, "traits"),
        (Conservation, Conservation.scientific_name, Conservation.common_name, "conservation"),
        (SpeciesImage, SpeciesImage.scientific_name, SpeciesImage.common_name, "species_images"),
    ):
        stmt = select(model).where(func.lower(sci_col) == raw.lower())
        row = await _one(db, stmt)
        if row:
            sci = getattr(row, sci_col.key)
            return Resolved(sci, getattr(row, com_col.key) if com_col is not None else None, label)

    # 7. The image dataset stores uppercase common names only.
    upper = re.sub(r"[^A-Z0-9 ]", " ", raw.upper()).strip()
    row = await _one(db, select(Species).where(func.upper(Species.name) == upper))
    if row and row.scientific_name:
        return Resolved(row.scientific_name, row.name, "species.name")

    # 8. Light fuzzy pass: folded equality, then an unambiguous prefix.
    for model, sci_col, com_col in (
        (Trait, Trait.scientific_name, None),
        (Conservation, Conservation.scientific_name, Conservation.common_name),
        (Taxonomy, Taxonomy.sci_name, Taxonomy.primary_com_name),
    ):
        for col in (sci_col, com_col):
            if col is None:
                continue
            rows = (await db.execute(
                select(model).where(func.lower(col).like(f"%{raw.lower()}%")).limit(25)
            )).scalars().all()
            exact = [r for r in rows if fold(getattr(r, col.key)) == folded]
            pool = exact or rows
            if len(pool) == 1:
                sci = getattr(pool[0], sci_col.key)
                if sci:
                    com = getattr(pool[0], com_col.key) if com_col is not None else None
                    return Resolved(sci, com, f"{model.__tablename__}.{col.key}~")

    return None


async def label_indices_for(db: AsyncSession, scientific_name: str) -> list[int]:
    """Which classifier classes map to this species.

    Usually one, but three classes share a species legitimately: ROCK DOVE,
    FRILL BACK PIGEON and JACOBIN PIGEON are all Columba livia.
    """
    rows = (await db.execute(
        select(Species.label_index).where(func.lower(Species.scientific_name) == scientific_name.lower())
    )).scalars().all()
    return sorted(rows)


async def common_name_for(db: AsyncSession, scientific_name: str) -> str | None:
    """The best human-readable name we have for a scientific name."""
    for model, sci_col, com_col in (
        (Taxonomy, Taxonomy.sci_name, Taxonomy.primary_com_name),
        (Conservation, Conservation.scientific_name, Conservation.common_name),
        (SpeciesImage, SpeciesImage.scientific_name, SpeciesImage.common_name),
    ):
        value = (await db.execute(
            select(com_col).where(func.lower(sci_col) == scientific_name.lower()).limit(1)
        )).scalar_one_or_none()
        if value:
            return value
    return None


async def scientific_name_for_common(db: AsyncSession, common_name: str) -> str | None:
    """The reverse lookup, used when only a common name is known."""
    resolved = await resolve_species(db, common_name)
    return resolved.scientific_name if resolved else None


async def name_variants(db: AsyncSession, scientific_name: str) -> list[str]:
    """Every spelling of this species across the sources.

    Tracking stores whatever name the tag's study reported, which is not always
    identical to eBird's, so joins on name need the full set rather than one.
    """
    variants = {scientific_name}
    pattern = f"%{scientific_name.split()[0]}%"
    for model, col in (
        (Trait, Trait.scientific_name),
        (Conservation, Conservation.scientific_name),
        (Taxonomy, Taxonomy.sci_name),
        (SpeciesImage, SpeciesImage.scientific_name),
    ):
        rows = (await db.execute(
            select(col).where(col.like(pattern)).where(or_(func.lower(col) == scientific_name.lower(), col.like(pattern)))
        )).scalars().all()
        for value in rows:
            if value and fold(value) == fold(scientific_name):
                variants.add(value)
    return sorted(variants)
