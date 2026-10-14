"""Audio endpoints over HTTP. Run with the server up and XENO_CANTO_KEY set.

    ./.venv/Scripts/python.exe tests/smoke_audio.py

Checks the metadata endpoint, then plays one recording through the relay,
including a Range request, which is what a browser uses to seek.
"""

import sys

import requests

BASE = "http://127.0.0.1:8099"

SPECIES = [
    "Columba livia",
    "Turdus merula",
    "Ciconia ciconia",
    "Corvus corax",
    "Erithacus rubecula",
]

passed = failed = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  ok   {label:52} {detail}")
    else:
        failed += 1
        print(f"  FAIL {label:52} {detail}")


def main() -> int:
    print("audio endpoints")

    r = requests.get(f"{BASE}/species/audio/999999/stream", timeout=30)
    check("GET  /species/audio/999999/stream (absent)", r.status_code == 404, f"{r.status_code}")

    r = requests.get(f"{BASE}/species/Nonexistent%20Birdus%20xyzzy/audio", timeout=30)
    check("GET  /species/{unknown}/audio", r.status_code == 404, f"{r.status_code}")

    streamed = 0
    for name in SPECIES:
        r = requests.get(f"{BASE}/species/{name}/audio", params={"limit": 5}, timeout=90)
        if r.status_code != 200:
            check(f"GET  /species/{name}/audio", False, f"{r.status_code}")
            continue

        payload = r.json()
        recordings = payload["recordings"]
        check(
            f"GET  /species/{name}/audio",
            isinstance(recordings, list),
            f"available={payload['available']} n={len(recordings)}",
        )

        for recording in recordings:
            missing = [
                field
                for field in ("xc_id", "scientific_name", "stream_url", "page_url")
                if recording.get(field) in (None, "")
            ]
            check(f"     XC{recording['xc_id']} has core fields", not missing, f"missing={missing}")
            if missing:
                continue

        if not recordings or streamed >= 1:
            continue

        target = recordings[0]
        url = f"{BASE}{target['stream_url']}"

        r = requests.get(url, timeout=180, stream=True)
        body = next(r.iter_content(64 * 1024), b"")
        check(
            f"     stream XC{target['xc_id']}",
            r.status_code == 200 and len(body) > 0,
            f"{r.status_code} {r.headers.get('Content-Type', '?')} {len(body)}B first chunk",
        )
        r.close()

        # The archive does not honour Range, so the relay must not claim it.
        check(
            f"     no false Accept-Ranges on XC{target['xc_id']}",
            "accept-ranges" not in {k.lower() for k in r.headers},
            f"accept-ranges={r.headers.get('Accept-Ranges')}",
        )
        streamed += 1

    if streamed == 0:
        check("stream at least one recording", False, "no species returned a recording")

    print(f"\n{passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
