"""Hit every endpoint and report status, timing and a size hint."""
import json
import time

import requests

BASE = "http://127.0.0.1:8099"

TESTS = [
    ("GET", "/", None),
    ("GET", "/health", None),
    ("GET", "/stats", None),
    ("GET", "/coverage", None),
    # species
    ("GET", "/species?page_size=3", None),
    ("GET", "/species?order=Passeriformes&page_size=2", None),
    ("GET", "/species?iucn=EN&page_size=2", None),
    ("GET", "/species?has_image=true&page_size=2", None),
    ("GET", "/species?has_tracks=true&page_size=5", None),
    ("GET", "/species/search?q=swallow", None),
    ("GET", "/species/filters", None),
    ("GET", "/species/Turdus%20merula", None),
    ("GET", "/species/american%20robin", None),
    ("GET", "/species/Ciconia%20ciconia", None),
    ("GET", "/species/Columba%20livia", None),
    ("GET", "/species/Turdus%20merula/image", None),
    ("GET", "/species/Ciconia%20ciconia/image", None),
    ("GET", "/species/Columba%20livia/summary", None),
    ("GET", "/species/Anas%20platyrhynchos/summary", None),
    ("GET", "/species/Ciconia%20ciconia/occurrences?limit=50", None),
    ("GET", "/species/Barn%20Swallow/migration", None),
    # occurrence
    ("GET", "/occurrence/migration", None),
    ("GET", "/occurrence/migration/barn%20swallow", None),
    ("GET", "/occurrence/migration/compare?names=Barn%20Swallow&names=Snow%20Goose", None),
    ("GET", "/occurrence/points?page_size=3", None),
    ("GET", "/occurrence/points/geojson?limit=100", None),
    ("GET", "/occurrence/ebird/regions", None),
    ("GET", "/occurrence/ebird/timeline?name=Barn%20Swallow", None),
    ("GET", "/occurrence/ebird?page_size=3", None),
    ("GET", "/occurrence/hotspots?page_size=3", None),
    ("GET", "/occurrence/hotspots/geojson?limit=50", None),
    ("GET", "/occurrence/observations?page_size=3", None),
    ("GET", "/occurrence/conditions", None),
    # tracking
    ("GET", "/tracking/studies", None),
    ("GET", "/tracking/studies/7431347", None),
    ("GET", "/tracking/species", None),
    ("GET", "/tracking/species/White%20Stork/tracks?resolution=monthly", None),
    ("GET", "/tracking/species/Ciconia%20ciconia/tracks?resolution=weekly", None),
    ("GET", "/tracking/individuals?page_size=3", None),
    ("GET", "/tracking/individuals?page_size=3&source=movebank", None),
    ("GET", "/tracking/individuals/1", None),
    ("GET", "/tracking/individuals/1/track", None),
    ("GET", "/tracking/bounds", None),
    # taxonomy / phylogeny / geo
    ("GET", "/taxonomy/orders", None),
    ("GET", "/taxonomy/families?order=Passeriformes", None),
    ("GET", "/taxonomy/search?q=corvus", None),
    ("GET", "/taxonomy/categories", None),
    ("GET", "/taxonomy/Corvus%20corax", None),
    ("GET", "/phylogeny/families", None),
    ("GET", "/phylogeny/tree", None),
    ("GET", "/phylogeny/species?page_size=3", None),
    ("GET", "/phylogeny/species/Turdus%20merula", None),
    ("GET", "/geo/richness/summary", None),
    ("GET", "/geo/richness?page_size=3", None),
    # classify
    ("GET", "/classify/classes", None),
    # errors
    ("GET", "/species/Nonexistent%20Birdus%20xyzzy", None),
    ("GET", "/species/Turdus%20merula/nope", None),
    ("GET", "/tracking/species/Nonexistent%20Birdus%20xyzzy/tracks", None),
]

fails = []
for method, path, body in TESTS:
    started = time.perf_counter()
    try:
        r = requests.request(method, BASE + path, json=body, timeout=180)
        ms = (time.perf_counter() - started) * 1000
    except Exception as exc:
        print("  ERROR %-4s %-58s %s" % (method, path, exc))
        fails.append((method, path, str(exc)))
        continue

    expected_error = "/nope" in path or "Nonexistent" in path
    ok = (r.status_code == 404) if expected_error else (r.status_code == 200)
    flag = "ok  " if ok else "FAIL"
    if not ok:
        fails.append((method, path, r.status_code, r.text[:300]))

    snippet = ""
    try:
        payload = r.json()
        if isinstance(payload, dict) and "items" in payload:
            snippet = "total=%s items=%d" % (payload.get("total"), len(payload["items"]))
        elif isinstance(payload, dict):
            keys = list(payload)[:6]
            snippet = "keys=" + ",".join(keys)
            if "features" in payload:
                snippet = "features=%d" % len(payload["features"])
        elif isinstance(payload, list):
            snippet = "list[%d]" % len(payload)
    except Exception:
        snippet = r.headers.get("content-type", "") + " %d bytes" % len(r.content)

    print("  %s %-4s %-58s %5d %7.0fms  %s"
          % (flag, method, path, r.status_code, ms, snippet[:70]))

print()
if fails:
    print("FAILURES (%d):" % len(fails))
    for f in fails:
        print("  ", f)
else:
    print("all %d checks passed" % len(TESTS))
