"""How much of the bird list actually has sound? Samples the backbone.

    ./.venv/Scripts/python.exe tests/audio_coverage.py [sample_size]

Answers the question directly rather than by reputation: it walks a spread of
species from the eBird backbone, asks `/species/{name}/audio` for each, and
reports what fraction came back with at least one recording. Queries are spaced
out because Xeno-canto throttles.
"""

import random
import sys
import time

import requests

BASE = "http://127.0.0.1:8099"
DELAY_SECONDS = 1.2


def sample_species(size: int) -> list[str]:
    """A spread across the whole backbone rather than one family."""
    r = requests.get(f"{BASE}/species", params={"page_size": 500, "page": 1}, timeout=60)
    r.raise_for_status()
    total = r.json()["total"]

    picks: list[str] = []
    pages = max(1, total // 500)
    step = max(1, pages // size)
    for page in range(1, pages + 1, step):
        r = requests.get(
            f"{BASE}/species", params={"page_size": 500, "page": page}, timeout=60
        )
        r.raise_for_status()
        picks.extend(item["scientific_name"] for item in r.json()["items"])

    random.Random(7).shuffle(picks)  # fixed seed: samples stay comparable
    return picks[:size]


def main() -> int:
    size = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    try:
        species = sample_species(size)
    except requests.RequestException as exc:
        print(f"could not read the species list: {exc}")
        return 1

    with_sound: list[tuple[str, int]] = []
    without: list[str] = []

    print(f"sampling {len(species)} species, {DELAY_SECONDS}s apart\n")
    for index, name in enumerate(species, 1):
        try:
            r = requests.get(f"{BASE}/species/{name}/audio", timeout=90)
            payload = r.json() if r.status_code == 200 else {}
        except requests.RequestException:
            payload = {}

        recordings = payload.get("recordings") or []
        if recordings:
            with_sound.append((name, len(recordings)))
        else:
            without.append(name)

        mark = "sound" if recordings else "  -- "
        print(f"  [{index:3}/{len(species)}] {mark}  {name}")
        if index < len(species):
            time.sleep(DELAY_SECONDS)

    answered = len(with_sound) + len(without)
    share = (100 * len(with_sound) / answered) if answered else 0.0

    print(f"\n{len(with_sound)}/{answered} sampled species have recordings ({share:.0f}%)")
    if without:
        print("\nno recording in the sample:")
        for name in without:
            print(f"  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
