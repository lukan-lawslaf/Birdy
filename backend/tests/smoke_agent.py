"""The identification agent, end to end.

    cd backend && ./.venv/Scripts/python.exe tests/smoke_agent.py

Runs the app in-process over an ASGI transport rather than against a live
server, so there is no port to pick and no uvicorn to keep alive — the request
still goes through the full stack, multipart parsing included. The classifier
is loaded by hand because the lifespan hook does not run under this transport.

Test images come from `/species/{name}/image`, so this needs no files on disk.
The no-bird case is generated here: a featureless square, which the classifier
should score near zero and the vision model should reject outright.
"""

import asyncio
import io
import json
import sys
from pathlib import Path

# This test imports the app directly, so backend/ must be importable no matter
# which directory it is launched from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx

# Common enough that the dataset certainly has a picture for each.
SPECIES = [
    "Haliaeetus leucocephalus",
    "Tyto alba",
    "Struthio camelus",
    "Pavo cristatus",
]

failures: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{f'  — {detail}' if detail else ''}")
    if not ok:
        failures.append(label)


def grey_square() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (448, 448), (128, 128, 128)).save(buf, "JPEG")
    return buf.getvalue()


async def main() -> int:
    from app.main import app
    from app.services import classifier

    classifier.load()
    print(f"classifier: {classifier.model_name()}\n")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=180) as c:
        # ------------------------------------------------------------ status
        print("[status]")
        r = await c.get("/agent/status")
        s = r.json()
        check("200", r.status_code == 200)
        check("classifier loaded", s["classifier_loaded"])
        check(
            "reports key presence, never the keys",
            all(isinstance(s[k], bool) for k in ("google_key", "groq_key")),
        )
        print(f"        text chain : {s['text_models']}")
        print(f"        vision     : {s['vision_model']} below {s['vision_threshold']:.0%}")

        # -------------------------------------------------- identification
        print("\n[identify — a confident photo of each species]")
        good: list[str] = []
        for name in SPECIES:
            image = await c.get(f"/species/{name}/image")
            if image.status_code != 200:
                print(f"  skip  {name}: no image ({image.status_code})")
                continue
            r = await c.post(
                "/agent/identify",
                files={"file": ("bird.jpg", image.content, "image/jpeg")},
                params={"top_k": 3},
            )
            if r.status_code != 200:
                check(f"{name} identified", False, f"HTTP {r.status_code}")
                continue
            b = r.json()
            good.append(name)
            check(
                f"{name} -> {b['common_name']}",
                b["scientific_name"] == name,
                f"{b['confidence']:.1%}, {b['summary_source']}, "
                f"{b['timings_ms']['total']:.0f} ms",
            )
            check(f"  summary written", bool(b["summary"] and len(b["summary"]) > 80))
            check(f"  cards returned", len(b["facts"]["cards"]) > 0 if b["facts"] else False)
            check(
                f"  no warnings on a confident hit",
                not b["warnings"] or b["decided_by"] == "classifier+vision",
                str(b["warnings"])[:80],
            )
            if name == SPECIES[0]:
                print(f"        {b['summary'][:150]}...")

        # ------------------------------------------------- vision cross-check
        print("\n[identify — verify=always forces the vision model to look]")
        image = await c.get(f"/species/{SPECIES[0]}/image")
        r = await c.post(
            "/agent/identify",
            files={"file": ("bird.jpg", image.content, "image/jpeg")},
            params={"verify": "always", "top_k": 3},
        )
        b = r.json()
        v = b["vision"]
        check("vision ran", v["ran"] is True, f"{v['elapsed_ms']} ms via {v['model']}")
        check("vision agreed", v["agrees"] is True, (v["note"] or "")[:90])
        check("no error", v["error"] is None)
        check("classifier kept", b["decided_by"] == "classifier")

        # ------------------------------------------------------- no bird here
        print("\n[identify — a photo with no bird in it]")
        r = await c.post(
            "/agent/identify",
            files={"file": ("grey.jpg", grey_square(), "image/jpeg")},
            params={"verify": "always"},
        )
        b = r.json()
        check("200, not an error", r.status_code == 200)
        check("is_bird false", b["is_bird"] is False)
        check("flagged uncertain", b["uncertain"] is True)
        check("warned the user", any("not think this photo" in w for w in b["warnings"]))
        check("still answered", b["scientific_name"] is not None, b["common_name"])

        # ----------------------------------------------------- skipping vision
        print("\n[identify — verify=never]")
        r = await c.post(
            "/agent/identify",
            files={"file": ("grey.jpg", grey_square(), "image/jpeg")},
            params={"verify": "never"},
        )
        b = r.json()
        check("vision did not run", b["vision"]["ran"] is False)
        check("low confidence still warned", any("Low confidence" in w for w in b["warnings"]))

        # --------------------------------------------------------- ask
        print("\n[ask — grounded question]")
        r = await c.post(
            "/agent/ask",
            json={"name": "Tyto alba", "question": "How heavy is it and is it threatened?"},
        )
        check("200", r.status_code == 200)
        b = r.json()
        check("answered", bool(b["answer"]))
        check("grounded in the record", "403" in b["answer"] or "Least Concern" in b["answer"],
              b["answer"][:100])

        # ------------------------------------------------------ describe
        print("\n[describe — same shape, no photo]")
        r = await c.get("/agent/species/Pavo cristatus")
        check("200", r.status_code == 200)
        b = r.json()
        check("has facts", b["facts"] is not None and bool(b["facts"]["cards"]))
        check("vision marked not run", b["vision"]["ran"] is False)
        check("summary present", bool(b["summary"]))

        # --------------------------------------------------------- guards
        print("\n[guards]")
        r = await c.post("/agent/identify", files={"file": ("x.jpg", b"", "image/jpeg")})
        check("empty upload -> 400", r.status_code == 400)

        r = await c.post("/agent/identify", files={"file": ("x.txt", b"hello", "text/plain")})
        check("wrong content type -> 415", r.status_code == 415)

        r = await c.post(
            "/agent/identify", files={"file": ("x.jpg", b"not an image", "image/jpeg")}
        )
        check("undecodable bytes -> 400", r.status_code == 400)

        r = await c.post(
            "/agent/identify",
            files={"file": ("x.jpg", grey_square(), "image/jpeg")},
            params={"top_k": 99},
        )
        check("top_k out of range -> 422", r.status_code == 422)

        r = await c.post(
            "/agent/identify",
            files={"file": ("x.jpg", grey_square(), "image/jpeg")},
            params={"verify": "sometimes"},
        )
        check("bad verify value -> 422", r.status_code == 422)

        r = await c.post("/agent/ask", json={"name": "Nonexistent Bird", "question": "how big"})
        check("unknown species -> 404", r.status_code == 404)

        r = await c.get("/agent/species/Notareal bird")
        check("unknown describe -> 404", r.status_code == 404)

    print(f"\n{'=' * 64}")
    if failures:
        print(f"{len(failures)} FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"all checks passed ({len(good)} species identified)")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
