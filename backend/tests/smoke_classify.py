"""Photo identification, end to end, entirely over HTTP.

For a sample of the 526 classes, fetch that class's picture from
`/species/{name}/image` and post it to `/classify/identify`. The model should
name the species it was drawn from.

This goes through the API rather than the database on purpose: it exercises the
image endpoint and the classifier together, and it is what a client does.

    cd backend && ./.venv/Scripts/python.exe tests/smoke_classify.py
"""

import io
import sys

import requests

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8099"
SAMPLE = 30


def main() -> int:
    classes = requests.get(f"{BASE}/classify/classes", timeout=60).json()
    print(f"model knows {len(classes)} classes")

    usable = [c for c in classes if c.get("scientific_name")][:SAMPLE]
    correct = 0
    checked = 0

    for entry in usable:
        image = requests.get(
            f"{BASE}/species/{entry['scientific_name']}/image", timeout=60
        )
        if image.status_code != 200:
            continue
        checked += 1

        response = requests.post(
            f"{BASE}/classify/identify",
            params={"top_k": 3},
            files={"file": ("bird.jpg", io.BytesIO(image.content), "image/jpeg")},
            timeout=120,
        )
        if response.status_code != 200:
            print(f"  HTTP {response.status_code}: {response.text[:120]}")
            continue

        top = response.json()["predictions"][0]
        # Three classes legitimately share a species (Columba livia appears as
        # ROCK DOVE, FRILL BACK PIGEON and JACOBIN PIGEON), so compare species.
        hit = top["scientific_name"] == entry["scientific_name"]
        correct += hit
        if not hit:
            print(
                "  MISS expected %-28s (%s) got %-28s (%s) %.1f%%"
                % (entry["common_name"], entry["scientific_name"],
                   top["common_name"], top["scientific_name"], top["confidence"] * 100)
            )

    print(f"\nexpected species in top-1: {correct}/{checked}")

    detail = requests.post(
        f"{BASE}/classify/identify",
        params={"top_k": 5},
        files={
            "file": (
                "bird.jpg",
                io.BytesIO(requests.get(f"{BASE}/species/Columba%20livia/image", timeout=60).content),
                "image/jpeg",
            )
        },
        timeout=120,
    ).json()
    print("inference %.1fms | %sx%s | %s"
          % (detail["inference_ms"], detail["image_width"], detail["image_height"],
             detail["model"].replace("\\", "/").split("/")[-1]))
    for p in detail["predictions"]:
        print("   %-30s %-24s %5.1f%%  iucn=%-3s %s"
              % (p["common_name"], p["scientific_name"], p["confidence"] * 100,
                 p["iucn_category"], p["profile_url"]))

    rejected = requests.post(
        f"{BASE}/classify/identify",
        files={"file": ("x.txt", io.BytesIO(b"not an image"), "text/plain")},
        timeout=30,
    )
    garbage = requests.post(
        f"{BASE}/classify/identify",
        files={"file": ("x.jpg", io.BytesIO(b"nonsense"), "image/jpeg")},
        timeout=30,
    )
    print(f"\ntext/plain upload -> {rejected.status_code} (expect 415)")
    print(f"garbage bytes     -> {garbage.status_code} (expect 400)")

    return 0 if correct == checked and checked else 1


if __name__ == "__main__":
    raise SystemExit(main())
