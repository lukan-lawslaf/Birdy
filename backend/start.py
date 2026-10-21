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
from urllib.parse import urljoin, urlparse

import requests

BACKEND = Path(__file__).resolve().parent
MAX_DOWNLOAD = 1024 * 1024 * 1024


def download_snapshot(url, archive):
    """Download a raw snapshot or concatenate verified private Storage parts."""
    headers = {}
    if key := os.environ.get("BIRDS_SNAPSHOT_ANON_KEY", ""):
        headers["Authorization"] = f"Bearer {key}"
    if token := os.environ.get("BIRDS_SNAPSHOT_TOKEN", ""):
        headers["x-snapshot-token"] = token
    with requests.get(url, headers=headers, stream=True, timeout=(15, 120)) as response:
        response.raise_for_status()
        content_type = str(response.headers.get("Content-Type", ""))
        if "application/json" not in content_type:
            size = 0
            with archive.open("wb") as output:
                for block in response.iter_content(1024 * 1024):
                    size += len(block)
                    if size > MAX_DOWNLOAD:
                        raise RuntimeError("Database download exceeds the 1 GB deployment limit")
                    output.write(block)
            return ""
        manifest = response.json()
    parts = manifest.get("parts", [])
    if manifest.get("version") != 1 or manifest.get("compression") != "gzip" or not 1 <= len(parts) <= 30:
        raise RuntimeError("Invalid database snapshot manifest")
    digest = manifest.get("sha256", "")
    if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
        raise RuntimeError("Snapshot manifest is missing its SHA-256")
    size = 0
    with archive.open("wb") as output:
        for part in parts:
            part_url = urljoin(url, part.get("url") or part["path"])
            if urlparse(part_url).scheme != "https" or urlparse(part_url).netloc != urlparse(url).netloc:
                raise RuntimeError("Snapshot parts must use the same HTTPS host")
            part_hash = hashlib.sha256()
            part_size = 0
            # Signed Storage URLs need no extra headers. Do not forward secrets.
            with requests.get(part_url, stream=True, timeout=(15, 120)) as response:
                if not response.ok:
                    raise RuntimeError(f"Snapshot part download failed ({response.status_code})")
                for block in response.iter_content(1024 * 1024):
                    size += len(block)
                    part_size += len(block)
                    if size > MAX_DOWNLOAD:
                        raise RuntimeError("Database download exceeds the 1 GB deployment limit")
                    part_hash.update(block)
                    output.write(block)
            if part_hash.hexdigest() != part.get("sha256") or part_size != part.get("size"):
                raise RuntimeError("Snapshot part checksum or size does not match")
    return digest


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
        manifest_digest = download_snapshot(url, archive)
        with archive.open("rb") as stream:
            compressed = stream.read(2) == b"\x1f\x8b"
        opener = gzip.open if compressed else open
        with opener(archive, "rb") as source, temporary.open("wb") as output:
            shutil.copyfileobj(source, output, length=1024 * 1024)
        with temporary.open("rb") as source:
            if source.read(16) != b"SQLite format 3\x00":
                raise RuntimeError("The downloaded snapshot is not a SQLite database")
        expected = os.environ.get("BIRDS_DB_SHA256", "").strip().lower() or manifest_digest
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
    if "--restore-only" in sys.argv:
        sys.exit(0)
    os.chdir(BACKEND)
    os.execv(sys.executable, [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", os.environ.get("PORT", "8000")])
