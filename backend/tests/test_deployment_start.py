import gzip
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import start


class SnapshotRestore(unittest.TestCase):
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
