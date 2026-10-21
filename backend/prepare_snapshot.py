"""Create a consistent, compressed deployment snapshot in upload-sized parts."""
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".deployment" / "snapshot"


def prepare():
    OUT.mkdir(parents=True, exist_ok=True)
    database = OUT / "birds.db"
    with sqlite3.connect(f"file:{ROOT / 'backend' / 'birds.db'}?mode=ro", uri=True) as source:
        with sqlite3.connect(database) as target:
            source.backup(target)
            if target.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise RuntimeError("Snapshot integrity check failed")
    with database.open("rb") as source:
        checksum = hashlib.file_digest(source, "sha256").hexdigest()
    archive = OUT / "birds.db.gz"
    with database.open("rb") as source, gzip.open(archive, "wb", compresslevel=6) as output:
        shutil.copyfileobj(source, output, 1024 * 1024)
    parts = []
    with archive.open("rb") as source:
        while block := source.read(40 * 1024 * 1024):
            name = f"birds-{checksum[:12]}.part{len(parts):03d}"
            (OUT / name).write_bytes(block)
            parts.append({"path": name, "sha256": hashlib.sha256(block).hexdigest(), "size": len(block)})
    manifest = {"version": 1, "compression": "gzip", "sha256": checksum, "size": database.stat().st_size, "parts": parts}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"sha256": checksum, "database_bytes": database.stat().st_size, "compressed_bytes": archive.stat().st_size, "parts": len(parts)}))


if __name__ == "__main__":
    prepare()
