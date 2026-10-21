"""Start a hosted API, restoring an immutable database snapshot when needed.

The snapshot is deployment data, not an ingest run. Free Render instances lose
their local disk on restart, so BIRDS_DB_URL must remain available to restore it.
"""
import gzip
import hashlib
import os
from pathlib import Path
import shutil
import sys

import requests

BACKEND = Path(__file__).resolve().parent


def restore_snapshot():
    target = BACKEND / "birds.db"
    if target.exists():
        return
    url = os.environ.get("BIRDS_DB_URL", "")
    if not url.startswith("https://"):
        raise RuntimeError("birds.db is missing. Supply an HTTPS BIRDS_DB_URL pointing to the database snapshot (SQLite or gzip).")
    archive = target.with_suffix(".download")
    temporary = target.with_suffix(".restoring")
    try:
        with requests.get(url, stream=True, timeout=(15, 120)) as response:
            response.raise_for_status()
            size = 0
            with archive.open("wb") as output:
                for block in response.iter_content(1024 * 1024):
                    size += len(block)
                    if size > 1024 * 1024 * 1024:
                        raise RuntimeError("Database download exceeds the 1 GB deployment limit")
                    output.write(block)
        with archive.open("rb") as stream:
            compressed = stream.read(2) == b"\x1f\x8b"
        opener = gzip.open if compressed else open
        with opener(archive, "rb") as source, temporary.open("wb") as output:
            shutil.copyfileobj(source, output, length=1024 * 1024)
        with temporary.open("rb") as source:
            if source.read(16) != b"SQLite format 3\x00":
                raise RuntimeError("The downloaded snapshot is not a SQLite database")
        expected = os.environ.get("BIRDS_DB_SHA256", "").strip().lower()
        if expected:
            with temporary.open("rb") as source:
                actual = hashlib.file_digest(source, "sha256").hexdigest()
            if actual != expected:
                raise RuntimeError("Database snapshot checksum does not match BIRDS_DB_SHA256")
        temporary.replace(target)
    finally:
        archive.unlink(missing_ok=True)
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    restore_snapshot()
    os.chdir(BACKEND)
    os.execv(sys.executable, [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", os.environ.get("PORT", "8000")])
