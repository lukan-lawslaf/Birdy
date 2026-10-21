import gzip
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import start


class SnapshotRestore(unittest.TestCase):
    def test_private_manifest_restore_and_secret_headers(self):
        raw = b"SQLite format 3\x00" + bytes(100)
        payload = gzip.compress(raw)
        manifest = MagicMock()
        manifest.__enter__.return_value = manifest
        manifest.headers = {"Content-Type": "application/json"}
        manifest.json.return_value = {"version": 1, "compression": "gzip", "sha256": hashlib.sha256(raw).hexdigest(), "parts": [
            {"url": "https://example.org/private-part?token=temporary", "size": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}
        ]}
        part = MagicMock()
        part.__enter__.return_value = part
        part.iter_content.return_value = [payload]
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as folder:
            with patch.object(start, "BACKEND", Path(folder)), patch.dict(start.os.environ, {
                "BIRDS_DB_URL": "https://example.org/manifest", "BIRDS_DB_SHA256": "",
                "BIRDS_SNAPSHOT_ANON_KEY": "jwt-key", "BIRDS_SNAPSHOT_TOKEN": "private-token",
            }), patch.object(start.requests, "get", side_effect=[manifest, part]) as get:
                start.restore_snapshot()
                self.assertEqual((Path(folder) / "birds.db").read_bytes(), raw)
                self.assertEqual(get.call_args_list[0].kwargs["headers"]["x-snapshot-token"], "private-token")
                self.assertNotIn("headers", get.call_args_list[1].kwargs)

    def test_rejects_snapshot_parts_on_another_host(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.headers = {"Content-Type": "application/json"}
        response.json.return_value = {"version": 1, "compression": "gzip", "sha256": "a" * 64,
            "parts": [{"url": "https://another-host.org/part", "size": 1, "sha256": "b" * 64}]}
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as folder:
            with patch.object(start, "BACKEND", Path(folder)), patch.dict(start.os.environ, {
                "BIRDS_DB_URL": "https://example.org/manifest"
            }), patch.object(start.requests, "get", return_value=response):
                with self.assertRaisesRegex(RuntimeError, "same HTTPS host"):
                    start.restore_snapshot()
                self.assertFalse((Path(folder) / "birds.db").exists())

    def restore(self, payload, expected=""):
        response = MagicMock()
        response.__enter__.return_value = response
        response.iter_content.return_value = [payload]
        test_directory = Path(__file__).resolve().parent
        with tempfile.TemporaryDirectory(dir=test_directory) as folder:
            self.assertTrue(Path(folder).resolve().is_relative_to(test_directory))
            with patch.object(start, "BACKEND", Path(folder)), patch.dict(start.os.environ, {
                "BIRDS_DB_URL": "https://example.org/birds.db.gz", "BIRDS_DB_SHA256": expected,
            }), patch.object(start.requests, "get", return_value=response):
                start.restore_snapshot()
                return (Path(folder) / "birds.db").read_bytes()

    def test_raw_and_gzip_snapshots(self):
        raw = b"SQLite format 3\x00" + bytes(100)
        digest = hashlib.sha256(raw).hexdigest()
        self.assertEqual(self.restore(raw, digest), raw)
        self.assertEqual(self.restore(gzip.compress(raw), digest), raw)

    def test_rejects_html_instead_of_database(self):
        with self.assertRaisesRegex(RuntimeError, "not a SQLite"):
            self.restore(b"<html>Not found</html>")

    def test_rejects_checksum_mismatch(self):
        with self.assertRaisesRegex(RuntimeError, "checksum"):
            self.restore(b"SQLite format 3\x00" + bytes(100), "incorrect")


if __name__ == "__main__":
    unittest.main()
