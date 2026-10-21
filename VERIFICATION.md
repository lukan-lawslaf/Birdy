# Frontend repair verification — 21 October 2026

The tested story is: choose or identify a bird in the browser, retrieve its
database profile, then inspect its conservation details, recording, model or
tagged migration journey.

## Results

| Requirement | Evidence |
| --- | --- |
| Agent popup stays beside its launcher | Computed position is `fixed`; body portal. At 1440 × 900 its result panel was 400 × 774 at x=1008, y=102. At 390 × 844 its idle panel stayed within the viewport, x≈12, bottom≈828. |
| Photo identification and questions | Uploaded a stored Bald Eagle photo through the real file chooser; UI returned Bald Eagle at 100%, a description and facts. Asked “How heavy is it?” and received 4700.6 grams. |
| Glossy navigation and responsive layout | Retained linen/sage day/dusk design; added restrained gloss. Atlas checked at 1440, 768 and 390 pixels with no horizontal page overflow. |
| Map works without a key | OpenStreetMap tiles loaded in-browser, with visible attribution. Phone map has a measured 460 px drawing height; desktop/tablet and phone journeys render. |
| Tracking controls and data | Switched White Stork → Osprey, chose January, played/paused the timeline. Months use the timestamps returned beside coordinates. White Stork and Ciconia ciconia return the same 6060 sampled fixes / 545 individuals. Full archive totals remain 742,755 fixes / 3,879 individuals across 36 normalized species. |
| Full conservation names | Verified Endangered in the catalogue and Least Concern in species details/atlas; all nine IUCN categories are mapped explicitly. Unknown values become Not Evaluated. |
| More 3D birds | 30 museum models plus two original GLBs, all 32 species resolve in the catalogue. Searchable rail, local models first, then taxonomic order/name. Rendered the Blue Jay museum scan and original Kingfisher; tested zoom, rotation and focus mode (canvas width 728 → 1432 px). |
| Correct species audio | Real Kingfisher and Hoopoe MP3s returned 200 audio/mpeg, 723155 / 1186424 bytes, with different SHA-256 prefixes (1e377783b56f / 538e1122e9ac). Browser playback displayed the correct recordist and Commons licence. Selecting another bird stops the prior player. |
| Catalogue/search/details | Keyboard `/` search, search selection from an Endangered-filtered catalogue, automatic filter reset, pagination to 2/14, grid/list views, phone profile scrolling and Escape dismissal were exercised. Escape does not reopen the intro. |
| Family tree | Searched “kingfisher”, selected Alcedinidae, saw 118 catalogue species and a valid family link, and exercised zoom. |
| Free deployment assessment | Vercel and Supabase connected documentation tools plus current Render docs reviewed. Configurations and snapshot bootstrap prepared; no deployment executed. See DEPLOYMENT.md. |

## Automated checks

- `npm run build` — TypeScript and Vite production build pass. Heavy pages are
  split into route chunks; the Three.js chunk is no longer needed by the home page.
- Existing `tests/smoke_api.py` against the updated API — **58/58 pass**.
- Existing `tests/smoke_agent.py` — all checks pass, including confident photos,
  forced vision, a non-bird photo, questions, descriptions and input guards.
- `python -m unittest discover -s tests -p 'test_*.py' -v` — **8/8 pass**.
  Covers coordinate/date alignment and distinct tagged individuals, exact-species
  credited Commons audio, provider fallback/settings, key-safe transport errors,
  gzip/raw database restoration and checksum/content rejection.
- `git diff --check` — passes.

## fix.md decisions

Added a bounded 60-second client response cache and in-flight request deduplication,
lazy route chunks, compression for JSON (media streams are excluded), and a small
serving requirements file without offline ingest dependencies. Existing debouncing,
skeletons, image lazy loading, pagination, SQLite indexes and connection management
already cover those suggestions. A load balancer adds no benefit to the current
single SQLite service. CDN delivery comes from the static host when deployed.

No Lighthouse score or cloud memory result is claimed. The taste skill's generic
style lint flags inherited glass, pill navigation, borders and monospace labels;
the established visual system and explicitly requested gloss were retained for
this component polish rather than applying a new site design.

## Practical limits

Xeno-canto returned 503 during testing. Playback now falls back to actual Commons
recordings, with separate credits; species with no playable recording show an
unavailable message. No procedural sound is passed off as a species call.

Sketchfab embeds depend on the public provider and WebGL support; textures are
capped at 1024 px to reduce device pressure. The model manifest holds source and
licence metadata, rather than unauthorized extracted GLBs. Camera capture uses
the browser's file/camera picker; a physical phone camera was not exercised here.

The hosting files have local build/startup test coverage, not a live cloud rollout.
Render Free cold starts, ephemeral SQLite, native inference memory, and snapshot
availability must be verified on the chosen host before launch.

Previews: [atlas](design/verification/atlas-desktop.jpg),
[phone map](design/verification/map-phone.jpg),
[phone dossier](design/verification/species-phone.jpg),
[phone agent](design/verification/agent-phone.jpg).
