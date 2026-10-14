"""Shared dependencies and small helpers for the routers."""

from typing import Annotated

from fastapi import Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db

DbDep = Annotated[AsyncSession, Depends(get_async_db)]

PageQuery = Annotated[int, Query(ge=1, description="1-based page number")]
PageSizeQuery = Annotated[int, Query(ge=1, le=500, description="Rows per page")]
SpeciesName = Annotated[str, Path(description="Scientific or common name, any casing")]


def page_meta(total: int, page: int, page_size: int) -> dict:
    """The pagination fields every list response carries."""
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if page_size else 0,
    }


def paginated(total: int, page: int, page_size: int, items: list) -> dict:
    """Build the envelope for a paginated route.

    Returned as a plain dict: FastAPI validates it against the typed
    `response_model=Page[Something]` declared on the route, which is what puts
    the item shape into the OpenAPI schema.
    """
    return {**page_meta(total, page, page_size), "items": items}


def not_found(what: str, name: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"No {what} found matching '{name}'")
