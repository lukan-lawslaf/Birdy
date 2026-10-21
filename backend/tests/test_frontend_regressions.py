"""Regression checks for the map and recording fallback; no external services."""
import unittest
from unittest.mock import Mock, patch

from app.services import commons_audio, llm
from app.services.tracks import _group


class MapTracks(unittest.TestCase):
    def test_same_tag_in_different_studies_stays_separate(self):
        rows = [
            {"individual_id": 1, "ident": "Bird 1", "ts": "2024-01-05", "latitude": 10, "longitude": 20, "source": "movebank", "study_id": "a"},
            {"individual_id": 1, "ident": "Bird 1", "ts": "2024-07-12", "latitude": 30, "longitude": 40, "source": "movebank", "study_id": "a"},
            {"individual_id": 2, "ident": "Bird 1", "ts": "2024-03-10", "latitude": 50, "longitude": 60, "source": "movebank", "study_id": "b"},
        ]
        features = _group(rows)
        self.assertEqual(len(features), 2)
        self.assertEqual(features[0]["properties"]["timestamps"], ["2024-01-05", "2024-07-12"])
        self.assertEqual(features[0]["geometry"]["coordinates"], [[20, 10], [40, 30]])
        self.assertEqual(features[1]["properties"]["individual_id"], 2)


class CommonsRecordings(unittest.TestCase):
    def test_exact_species_category_and_credited_audio_only(self):
        commons_audio._CACHE.clear()
        metadata = {"Artist": {"value": '<a href="/author">Field recordist</a>'}, "LicenseShortName": {"value": "CC BY 4.0"}, "LicenseUrl": {"value": "https://creativecommons.org/licenses/by/4.0/"}}
        info = {"mime": "audio/mpeg", "size": 15000, "url": "https://upload.wikimedia.org/robin.mp3?utm_source=commons", "descriptionurl": "https://commons.wikimedia.org/wiki/File:Robin.mp3", "extmetadata": metadata}
        response = Mock()
        response.json.return_value = {"query": {"pages": {
            "1": {"title": "File:Robin.mp3", "imageinfo": [info]},
            "2": {"title": "File:Video.ogv", "imageinfo": [{**info, "mime": "video/ogg"}]},
            "3": {"title": "File:Unlicensed.mp3", "imageinfo": [{**info, "extmetadata": {}}]},
        }}}
        with patch.object(commons_audio.requests, "get", return_value=response) as get:
            recordings = commons_audio.recordings("Erithacus rubecula")
            self.assertEqual(get.call_args.kwargs["params"]["gcmtitle"], "Category:Audio files of Erithacus rubecula")
            self.assertEqual(len(recordings), 1)
            self.assertEqual(recordings[0]["recordist"], "Field recordist")
            self.assertNotIn("?", recordings[0]["url"])
            commons_audio.recordings("Erithacus rubecula")
            self.assertEqual(get.call_count, 1)


class ModelRecovery(unittest.TestCase):
    def test_gemini_3_uses_current_thinking_settings(self):
        payload = llm._gemini_payload("gemini-3-flash-preview", "Name the bird", None, 400, .1, None)
        self.assertEqual(payload["generationConfig"]["thinkingConfig"], {"thinkingLevel": "minimal"})

    def test_vision_tries_the_fallback(self):
        answer = object()
        with patch.object(llm, "_invoke", side_effect=[llm.LlmUnavailable("HTTP 503"), answer]) as invoke:
            self.assertIs(llm.look(b"image", "image/jpeg", "Name the bird"), answer)
            self.assertEqual(invoke.call_count, 2)

    def test_transport_errors_do_not_disclose_the_key(self):
        with patch.object(llm.requests, "post", side_effect=llm.requests.ConnectionError("https://example.org/?key=private-token")):
            with self.assertRaises(llm.LlmUnavailable) as caught:
                llm._call_google("gemini-3-flash-preview", "Hello", None, 50, .1, None)
            self.assertNotIn("private-token", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
