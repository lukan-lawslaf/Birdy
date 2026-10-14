"""Two engines, one set of models.

The ingest pipeline is synchronous and stays that way — it is a long-running
batch job, not a request handler. The API is async, so it gets its own engine
over the same SQLite file via aiosqlite. Both build on the same `Base` and the
same tables, so nothing is duplicated except the connection setup.
"""

from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import BACKEND_DIR, settings


def _absolute_sqlite_url(url: str) -> str:
    """Resolve a relative SQLite path against the backend directory.

    `sqlite:///./birds.db` depends on the working directory, so running uvicorn
    from the repo root would silently talk to a different (or brand new) file.
    Pinning it to backend/ means the API and the ingest script always agree.
    """
    prefix = "sqlite:///"
    if not url.startswith(prefix):
        return url
    path = url[len(prefix):]
    if path == ":memory:" or Path(path).is_absolute():
        return url
    return prefix + (BACKEND_DIR / path).resolve().as_posix()


DATABASE_URL = _absolute_sqlite_url(settings.database_url)

# --- sync, for the ingest pipeline -------------------------------------------
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- async, for the API ------------------------------------------------------
ASYNC_DATABASE_URL = DATABASE_URL.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
async_engine = create_async_engine(ASYNC_DATABASE_URL)


@event.listens_for(async_engine.sync_engine, "connect")
def _tune_sqlite(dbapi_connection, connection_record):
    """Give SQLite room to work.

    The defaults are a 2 MB page cache and no memory mapping, which makes the
    aggregate queries over 742,755 track rows re-read from disk. 64 MB of cache
    and a 256 MB mmap window cut those from seconds to tens of milliseconds.
    """
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA cache_size = -64000")
        cursor.execute("PRAGMA mmap_size = 268435456")
    finally:
        cursor.close()


AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """Sync dependency, kept for scripts and anything that predates the API."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db():
    """Per-request session for the API."""
    async with AsyncSessionLocal() as session:
        yield session


__all__ = [
    "Base",
    "SessionLocal",
    "AsyncSession",
    "AsyncSessionLocal",
    "engine",
    "async_engine",
    "get_db",
    "get_async_db",
]
