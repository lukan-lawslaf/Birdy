# Progress

## 2026-10-12 — project built

### Data audit (what we actually had)

Four unrelated data domains, ~2.5 GB, all under `data/`:

| Source | What it is |
|---|---|
| `CUB_200_2011.tgz` | 11,788 photos, 200 species, 312 visual attributes, 15 part locations |
| `16586228.zip` | AVONET (Zenodo): traits for 11,009 species, phylogeny, global richness grid, R code |
| `species-filter-results.zip` | BirdLife: IUCN status, population, range for 11,185 species |
| `eBird_Taxonomy_v2021.csv.zip` | eBird name backbone, 16,752 rows |
| `ebd-datafile-SAMPLE.zip` | eBird observations, one Alabama county, March 2025 |
| Sagebrush CSVs | Movebank 33-1299: geolocator tracks, 3 species, 44 tagged birds |
| `birds-525-*.ipynb` | MobileNetV2 → 525 species notebook |

Two things in the project were broken and are now understood:

- The notebook reads Kaggle `gpiosenka/100-bird-species`. **That dataset no longer
  exists on Kaggle** — the notebook cannot run as written. The Hugging Face mirror
  `yashikota/birds-525-species-image-classification` is the same data and works.
- The notebook trained a model to 87.9% validation but **never saved the weights**.
  There were zero model files in the project.

### Model — fixed

No retraining needed. Found published models trained on the exact same classes,
quantized to int8, and verified against the real validation split (not the model card).

- **`models/bird-525-swin-int8.onnx`** — 29.9 MB, **98.0% top-1**, 33 ms/image. This is the one to use.
- Labels live next to it in `models/bird-525-labels.json` (526 entries).
- GGUF does not apply to image classifiers; int8/ONNX is the equivalent.
- Rejected: EfficientNetB2 scores 71.6%. Cause found — the dataset has 526 classes,
  its label list has 525, so ~145 classes shift by one index. Not a preprocessing
  problem (every resize/normalize variant measured 70–72%). Also 9x slower.
- Deleted: a `chriamue` ONNX export that returns a flat uniform distribution for
  every input, and the 109 MB float32 copy.

### Migration data

**GBIF** (free, no key) — 12 species, 1,440 georeferenced records each sampled evenly
across all 12 months, plus monthly totals over the full record set. Curves are
biologically correct: Barn Swallow peaks May and vanishes Dec–Feb; Snow Goose
**inverts** (peaks Dec–Feb, winters in the US, breeds in the Arctic); Whimbrel shows
the classic **double peak** of spring and autumn passage.

**eBird** — the key in `.env` works. The API has no "species across the year"
endpoint, so migration is reconstructed by sampling one day per month in six flyway
regions (US-MA, US-TX, US-CA, US-IL, US-AK, GB) for 2024. Result: 16,692 records and
57,512 hotspots.

One limitation worth knowing: the historic endpoint returns at most one record per
species per day, so `observation_count` is 1 in every row. This table records whether
a species was seen in a region that month, not how many were counted. It still carries
a real signal — species reported per month in US-MA peak in May (229) and September
(222) against a January low of 161, which is the correct spring-and-autumn shape. For
abundance curves use the GBIF tables instead.

Two gaps in this data: sampling is a single day (the 15th) per region-month, and the
API applies no effort correction, so busy months partly reflect when people go birding.
Getting proper weekly abundance maps means eBird Status & Trends, which is a separate
Cornell product needing an account, not the API.

Real animal-borne GPS tracks beyond the Sagebrush set are now in as well — see
the **Tracking data (Movebank)** section below. GBIF still gives where birds were
*seen*, which is a different question from where tagged birds went.

### Database and pipeline

SQLAlchemy + SQLite. This is a data pipeline, not a web application.

- `backend/birds.db` — **931,730 rows across 21 tables**, 282 MB
- `backend/app/ingest/run.py` rebuilds the whole database; each loader clears its own
  table first, so it is idempotent
- `backend/app/models.py` defines the 21 tables; `config.py` holds the paths
- Own virtualenv at `backend/.venv` — installing into the shared environment
  downgraded packages the hermes agent needs, so this was moved out

Table coverage: traits 11,009 · conservation 11,185 · taxonomy 16,753 ·
observations 4,863 (+317 sampling events) · species 526 · CUB 200 classes / 11,788
images · GBIF 17,280 points + 12 curves · eBird 16,692 samples + 57,512 hotspots ·
movement 708,817 Movebank points + 33,938 sagebrush, 3,835 Movebank individuals ·
phylogeny 483 nodes / 6,670 tips · richness 18,421 cells ·
species_images 11,101 (525 with bytes, 10,576 URLs) · species_summaries 250 ·
movebank_studies 34.

Rebuild:

```bash
cd backend && ./.venv/Scripts/python.exe -m app.ingest.run
```

**Name matching — resolved.** The 526 image classes only store uppercase common names,
so most did not match the names in the trait and conservation tables. There are now
three passes: BirdLife common name, then the eBird taxonomy, then a hand-written alias
table at `backend/name_aliases.csv`.

```
before:  402 / 526  (76%) matched to a scientific name
after:   524 / 526  (99.6%)
```

Downstream joins, now that the names resolve:

| | |
|---|---|
| image species with a scientific name | 524 / 526 (99.6%) |
| joined to an AVONET trait record | 509 / 526 (97%) |
| joined to a BirdLife conservation record | 515 / 526 (98%) |
| joined to both | 509 / 526 (97%) |

The alias table is 124 rows and carries a confidence column, so every hand correction is
reviewable. Most were simple source typos (`BLACKBURNIAM` -> Blackburnian, `NOODY` ->
Noddy, `AUCKLAND SHAQ` -> Auckland Islands Shag). The rest were renamed species the
dataset never updated (its `BARN OWL` is now Western Barn Owl; `SAND MARTIN` is Bank
Swallow in eBird's list) or truncated names.

Two classes could not be resolved, and both turned out to be **corrupt data in the
source dataset**. I extracted and looked at the images rather than guess:

- **`LOONEY BIRDS` (label 332)** — not a bird. All five images are photographs of
  people. A junk class that will make any model trained on this data fire on human
  faces.
- **`CRESTED NUTHATCH` (label 173)** — no bird has this name, and the class is a mix:
  three Red-breasted Nuthatch, two White-breasted Nuthatch.

Both are left unmatched deliberately, so nothing downstream silently uses a wrong
species. Two other labels only looked unresolvable and were settled by viewing the
images: `SAMATRAN THRUSH` is Sumatran Laughingthrush (3 of 5 images match) and
`TEAL DUCK` is Green-winged Teal (4 of 5 match, one is a stray Mallard).

### Species images

Every species gets one representative picture. Stored two ways, for two reasons:

| source | how | stored as | scale |
|---|---|---|---|
| `dataset` | first validation-split image for each of the 526 classes, read from the local parquet | **JPEG bytes** in the row | longest edge 640 px |
| `wikipedia` | lead image by scientific name, via `prop=pageimages\|info` | **URLs only** — thumbnail, original, and the Wikipedia page | thumbnail asked at 480 px |

The dataset species are the ones the classifier knows, so their bytes live in the
database: those are always available offline with no network call. The Wikipedia
species are browsed rather than fed to a model, so storing ~11,000 more JPEGs
would just bloat the file and cost download+encode time — those rows keep URLs
and no bytes. `image` is therefore populated for dataset rows and NULL for
Wikipedia rows, and the URL columns are the other way round.

Rows record `source`, `source_url` (thumbnail), `original_url`, `wikipedia_url`,
`attribution`, `width`, `height`, `bytes_len`.

Implementation: `backend/app/ingest/images.py`, called from `run.py` as the
`species photos` step. The table is dropped and recreated at the start of every
run, so a schema change never needs a migration and a killed run costs only time.

**Result of the full run:** **525 dataset rows + 10,576 Wikipedia rows = 11,101**,
in 519 s. 10,576 of the 11,013 names looked up (96.0%) had a lead image. During
the run Wikipedia returned two 429s; both were retried and recovered after
honouring `Retry-After` (4 s and 8 s), and nothing was lost.

**Network discipline (copied from the Rayquaza project — this is what fixed the
throttling):** 50 titles per request, **1.0 s between requests**, up to **5
retries**, exponential backoff capped at 30 s, and the server's `Retry-After`
header is **honoured** on 429/503.

**Things learned the hard way, worth not repeating:**

- The first attempt paced at 0.1 s and ignored `Retry-After`; 201 of 221 batches
  came back as HTML error pages instead of JSON. At 1.0 s with backoff the rerun
  showed zero failures.
- An even earlier version downloaded and decoded all ~11,000 images before
  inserting them, which exhausted system memory and the job was killed. Dropping
  the bytes for Wikipedia rows removes that whole class of problem.
- The first version stored one image several times under different title aliases,
  keying on the Wikipedia page title *and* every requested alias. It now maps each
  requested name to the single title Wikipedia resolved.
- Three image classes legitimately map to the same species: `ROCK DOVE`,
  `FRILL BACK PIGEON` and `JACOBIN PIGEON` are all Rock Pigeon. Expect three rows
  for *Columba livia*; that is correct, not duplication.

**Not yet captured: the licence of each picture.** `source_url` and `attribution`
are stored, but the per-file licence is not. Wikipedia and Commons are mostly
CC BY-SA but vary per file, so this needs a Commons `extmetadata` lookup before
anything ships. Roughly 220 more batched requests.



### Species summaries (Wikipedia text)

A few sentences of description per species, for the "about" panel, with a
**read on Wikipedia** link. Stored in `species_summaries` (scientific name is the
join key).

**Only the top 250 species get stored text.** Everything else keeps just the
page URL, which is already in `species_images` for 10,576 species — there is no
point fetching and storing 11,000 blurbs nobody opens. The 250 are ranked by our
**own** evidence of how common a species is: how many region-months it appears in
across `ebird_migration_samples` plus how often it appears in `observations`. The
result is the birds people actually see — top of the list is Rock Dove, Canada
Goose, Mallard, Common Starling, House Sparrow.

Source is the Wikipedia **REST summary** endpoint, one request per species:

```
GET https://en.wikipedia.org/api/rest_v1/page/summary/<scientific_name>
```

Two things learned here:

- **`action=query&prop=extracts` no longer works.** It returns HTTP 200 with an
  empty `extract` for every title. The REST summary endpoint is the working one.
  It has no batch form, hence one request per species.
- **A contact in the User-Agent is what stops the 429s.** With a bare
  `bird-atlas/0.1` UA, roughly 70% of requests were throttled. Adding a contact
  string to the UA dropped that to zero at the same concurrency (6 threads).
  The contact in the code is a placeholder — replace it with a real one.

Implementation: `backend/app/ingest/summaries.py`, step `species summaries`.
It runs **last** in `run.py`, because the ranking reads the eBird and observation
tables that earlier steps fill.

### Bird sound (Xeno-canto) — metadata only, audio relayed

The project had no audio at all until this. The dataset is entirely visual,
occurrence and traits — 20 tables, none of them sound.

Sound now comes from **Xeno-canto**, and the one design rule is that the audio is
**never stored**. The catalogue entry is kept in `species_audio` (recordist,
country, locality, coordinates, sound type, quality grade, length, date, licence,
and the archive's own URLs); the bytes stay on Xeno-canto's servers and are
relayed through the API when a player asks for them. Three reasons: ~10,000
mirrored files would dwarf the rest of the database; the licence is per
recording, so pointing at the original is the cleanest way to honour it; and a
local copy would quietly go stale against re-uploads and corrections.

```
GET /species/{name}/audio        -> catalogue entries, best-graded first
GET /species/audio/{xc_id}/stream -> the audio bytes
```

`sound_type` distinguishes song from call, `quality` is the archive's own A–E
grade, and `sonogram_url` lets the frontend draw the spectrogram.

Rows are written **lazily**: the first request for a species queries the archive
and keeps the answer, so a species page viewed repeatedly costs one query rather
than one per view. A species with no recordings is a normal result, not an
error — the endpoint returns `available: false`, and a query failure degrades to
whatever is cached rather than a 500, so a page still renders when the archive is
down.

### Three things the archive's own behaviour forced

All three were measured against the live API, not assumed, and each changed the
code. `backend/_xc_*_probe.py` were the throwaway scripts that found them.

**1. API v3 refuses free text.** `query=Columba livia` is rejected outright —
v3 only accepts tagged queries. `sp:"Genus species"` is the form that matches a
full binomial (313 results for *Columba livia*). English names are not a safe
alternative: `en:"Rock Pigeon"` returns Chestnut-quilled Rock Pigeon.

**2. The archive never transcodes, and never says what format it is serving.**
`/download` returns the file the recordist uploaded — measured 14.5 MB for a
41-second WAV against 400 KB for equivalent mp3s — and no format parameter
changes that (`?format=mp3`, `?quality=mp3` both ignored). The only signal is
the extension on the original filename, so `format` is parsed from it and the
sort puts compressed formats **ahead of quality**: a slightly rougher mp3 beats
a flawless 50 MB WAV on a phone. That is not a rare case — of the first 3,393
recordings cached, **540 are WAV**, so roughly one in six would otherwise have
been a multi-megabyte download by default.

**3. There is no Range support.** A `Range: bytes=0-1023` request came back as a
**full 200 with the entire body**, not a 206, and `Accept-Ranges` is absent. The
relay therefore does not advertise `Accept-Ranges` either — claiming seek support
it cannot pass through would leave a player waiting on a range that never comes.
Playback still works (browsers buffer as they go); it just cannot jump ahead.

The relay does still carry a `Referer` as well as a User-Agent, since the archive
serves audio only to callers that look like a browser on its own pages.

**Setup:** Xeno-canto v2 is retired (it now answers 404) and v3 requires a
personal API key — the site login is *not* enough. Log in at
<https://xeno-canto.org/account>, copy the key into `XENO_CANTO_KEY` in `.env`.
The key is attached to the stream URL at request time, so it never lands in the
database file.

**Coverage — measured, not assumed.** `tests/audio_coverage.py` samples species
spread across the whole backbone and asks the API. Two independent samples:

```
 40 species sampled ->  37 with recordings  (92%)
120 species sampled -> 110 with recordings  (92%)
```

The 120-species misses are not a random gap, they are structural. **Six are
extinct** — *Necropsar rodericanus*, *Columba versicolor*, *Pomarea nukuhivae*,
*Coturnix novaezelandiae*, *Akialoa lanaiensis*, *Carpodacus ferreorostris*. The
other four are rare or remote: *Caprimulgus binotatus* (a nightjar),
*Crateroscelis nigrorufa* (a New Guinea babbler), *Leptoptilos dubius* (Greater
Adjutant), *Sicalis uropygialis* (a high-Andes finch). So the archive is thin
exactly where you would expect it to be — extinct species, nightbirds, and birds
few people have recorded — and a species page should render "no recording yet"
as a real state rather than an error.

### Tracking data (Movebank)

Real GPS/Argos telemetry, pulled live from the Movebank `direct-read` API with
the project's own account (credentials in `.env`). This replaces the earlier
"only 3 species" limitation, which was simply the size of the pre-packaged
sagebrush sample.

`movement_tracks` / `movement_individuals` now carry a **`source`** column and a
`study_id`: the three sagebrush species are `source='sagebrush'`, everything
pulled from the API is `source='movebank'`. One canonical tracks table, two
provenances. `movebank_studies` holds each study's licence, citation and PI —
Movebank requires citation for CC BY / CC BY-NC data, so that is stored verbatim.

**What the API actually requires** (all of this cost time to work out):

- `direct-read` needs the account (HTTP Basic). The **open** JSON endpoint
  (`service/public/json`) does *not* serve events — it returns
  `Invalid entity type: event` — so an account is the only route to events.
- **`i_can_see_data` is not the right gate.** Being able to *see* a study does not
  mean you can *download* it; the study list's `i_have_download_access` column is
  the one that matters (1,006 studies of 8,805). Filtering on the wrong column
  gives "No data are available for download".
- **Licence acceptance is a hash handshake.** Until a study's terms are accepted,
  the response is an HTML licence page, not data. Accept it by MD5-ing that
  page's **raw bytes** and re-sending the request with `license-md5=<hash>`.
  Hashing the decoded text instead of the bytes gives a wrong hash — Movebank
  sends no charset, so `requests` decodes as ISO-8859-1 and re-encoding changes
  it. The hash is per study and per user and does not depend on the other
  parameters, so it is computed once.
- **Always ask for the reduction, even when no licence is needed.** Studies that
  need no acceptance return data on the first call; without
  `event_reduction_profile` that call returns every raw fix (one study came back
  with 482,810 rows and truncated mid-stream). Every request now carries the
  reduction, so the shape is the same either way.

Event shape: `event_reduction_profile=EURING_01` gives **one point per individual
per day**, plus `individual_taxon_canonical_name`, so each row carries its own
species name. Clean migration paths, bounded size.

The study set is hand-picked (34 studies, ~25 species) — well-tracked migrants
across several flyways: White Stork, Sooty Tern, Manx Shearwater, Snow/Canada
Goose, Wood Stork, Whooping Crane, Black Kite, Egyptian and Griffon Vulture,
Osprey, Northern Gannet, Bar-tailed Godwit, Long-billed Curlew, Buff-breasted and
Semipalmated Sandpiper, Eurasian Woodcock, Antarctic Petrel, Swallow-tailed Gull,
Red-tailed Tropicbird, Yellow-nosed Albatross, Common Kestrel, Mallard,
Swainson's Thrush. The list is `CURATED` in `backend/app/ingest/movebank_client.py`.

Still not obtained: a **bulk** pull across all ~1,000 downloadable studies. The
curated set is the start; widening it is a one-line change to `CURATED`.



### The API

The database is now served over HTTP. Same layout as the Rayquaza project —
`main.py`, `routers/`, `schemas.py` — but the shape of the routes comes from
what this data actually is, not from that project's.

```
backend/app/main.py       FastAPI app, CORS, routers
backend/app/schemas.py    every response model (Pydantic v2)
backend/app/routers/      one module per domain, 45 endpoints
backend/app/services/     resolve.py · classifier.py · tracks.py
backend/tests/            smoke_api.py (58 checks) · smoke_classify.py · smoke_audio.py · audio_coverage.py
```

| Router | Endpoints | What it serves |
|---|---|---|
| `/species` | 10 | the hub — list, search, filters, profile, image, sound, summary, occurrence map, migration curve |
| `/occurrence` | 12 | GBIF points + curves + GeoJSON, eBird presence/regions/timeline, hotspots, raw checklists |
| `/tracking` | 8 | studies with licence and citation, tagged individuals, tracks as GeoJSON, bounds |
| `/taxonomy` | 5 | the eBird backbone — orders, families, categories, search |
| `/phylogeny` | 4 | the family tree (nested), the Hackett species tips |
| `/geo` | 4 | richness as GeoJSON points, by country, as cells, and the histogram |
| `/classify` | 2 | `POST /identify` and the class list |
| `/meta` | 4 | root, health (live DB check), row counts, provenance and coverage notes |

49 endpoints, and every 200 response is a named schema in the OpenAPI document
— no untyped inline objects. `/species` and the other list endpoints return
`Page[Item]`, so a generated client sees the real shape of `items` rather than
`any[]`.

**Four decisions worth recording**, because each had a real alternative:

1. **Async, not sync.** The skill's rule and the reference project disagreed —
   Rayquaza is sync. The ingest pipeline stays sync (it is a batch job), and the
   API gets its own async engine over the same file via `aiosqlite`. Both build
   on the same `Base`, so only the connection setup is duplicated.
2. **A live join, not a materialised table.** `GET /species/{name}` assembles
   trait, conservation, taxonomy, image, summary and tracking blocks at request
   time. There is no master species table to build it from — the six sources
   hold 11,009 / 11,185 / 16,753 / 526 / 11,101 / 250 different name sets — so a
   profile is a resolution step followed by joins. Missing blocks come back null,
   which is normal rather than an error.
3. **Tracks as GeoJSON with a resolution parameter.** `daily` (as stored),
   `weekly`, `monthly`, thinned server-side. Thinning picks the real earliest fix
   in each bucket rather than averaging coordinates, so every point on the map is
   somewhere the bird actually was — that relies on SQLite returning bare columns
   from the row holding the `MIN()`. If the requested resolution would still
   exceed 25,000 points it is coarsened automatically and the response reports
   the resolution actually used.
4. **The classifier is exposed.** `POST /classify/identify` takes an upload and
   returns ranked predictions enriched with IUCN status, a profile link and an
   image link. Verified round-trip: **24/24 top-1** on stored dataset images,
   36.8 ms per image.

**Name resolution.** Clients pass a scientific *or* common name, any casing.
`services/resolve.py` walks a cascade — eBird scientific → eBird common → AVONET
→ BirdLife → image table → uppercase dataset names → folded/unambiguous-prefix
search — and whatever it lands on becomes the canonical scientific name for the
rest of the request. A folded comparison (strip accents, keep letters only) is
what makes the dataset's all-caps typo-ridden names matchable.

**Three performance problems worth remembering.** All three were measured, not
guessed:

- **`COUNT(DISTINCT x)` alongside `COUNT(*)` is a trap.** Asking
  `movement_tracks` for both at once made SQLite build a temporary B-tree over
  all 742,755 rows — 4.4 s for `/tracking/studies`, 1.4 s just to count one
  species' individuals. Split in two it is ~100 ms: the plain count is answered
  from a covering index, and the distinct half is a 3,835-row lookup on
  `movement_individuals`, which is where one row per bird already lives.
- **`SELECT DISTINCT` on the big table is the same mistake.** Name resolution
  wanted the list of tracked taxa; asking `movement_tracks` for it cost ~1 s per
  call, asking the individuals table costs 5 ms for the identical 47 names.
- **SQLite's defaults are too small for a 257 MB database.** A 2 MB page cache
  and no memory mapping meant re-reading from disk. The API's connections now set
  a 64 MB cache and a 256 MB mmap window. Three indexes were also added
  (`study_id`, `source`, `animal_taxon`) through the ingest migration, since
  `create_all` will not add an index to a table that already exists.

**Image serving.** `GET /species/{name}/image` is one URL that always works:
byte-backed dataset rows are served straight from SQLite, and Wikipedia rows are
fetched server-side and proxied, with a 256-entry in-process cache and a
day-long `Cache-Control`. It proxies rather than redirects because Wikimedia
answers **403** to any client whose User-Agent does not identify it — a redirect
works in a browser and silently fails everywhere else.

**The richness grid has coordinates.** `RichnessTable.csv` carries only a
`WorldID` and counts, so the ingest joins in location from two companion files
in the same archive: cell centres parsed from the Behrmann shapefile, and the
country from `CountryBehrmannMeterGrid_WGS84_land.csv`. Both were read with
stdlib `struct` — no GDAL, no pyproj. All **18,421 cells** came out with a
latitude, a longitude and a country, which makes `/geo/richness/geojson` a real
map layer rather than just a histogram.

The result is self-checking: the richest cells are all Andes and Amazon
(Ecuador 972, Colombia 898, Peru 895, Bolivia 886) and the countries with the
highest *mean* richness per cell are Guyana 527, Suriname 511, Uganda 511,
Colombia 477 — the tropical belt, where the world's birds actually are. `/geo`
tiers by mean per cell rather than total, so small equatorial countries are not
beaten by large temperate ones.

**Known limits, stated in `/meta/coverage` so the frontend can show them:**

- Species summaries exist for the **250 most-recorded species only** — the
  ranking is US-weighted, so e.g. Common Blackbird (a European bird) is not in
  it and returns 404 with the reason. Every species still has its Wikipedia URL.
- The classifier knows **526 classes**. A bird outside them comes back as the
  nearest class it does know; check the confidences.

Run it:

```bash
cd backend && ./.venv/Scripts/python.exe -m uvicorn app.main:app --reload
```

Docs at `http://127.0.0.1:8000/docs`. Test it (with the server up):

```bash
cd backend && ./.venv/Scripts/python.exe tests/smoke_api.py
cd backend && ./.venv/Scripts/python.exe tests/smoke_classify.py
cd backend && ./.venv/Scripts/python.exe tests/smoke_audio.py      # needs XENO_CANTO_KEY
cd backend && ./.venv/Scripts/python.exe tests/audio_coverage.py 40
```

`database.py` now pins a relative SQLite path to `backend/`, so the API and the
ingest script always agree on which file they mean regardless of the working
directory.

### Removed

A FastAPI service (19 endpoints, six routers) and a Vite/React frontend (seven pages)
were built here and then deleted. They were never asked for — the goal was the data
and the database, not an application. The frontend in particular went well past the
"folder structure referencing Rayquaza" that was requested. Delete the git history for
those paths if it matters; nothing else depends on them.

### Cleanup

- Duplicate model copy removed; one canonical model now lives in `models/`
- Broken ONNX export and float32 duplicate deleted
- Temp extraction directories removed
- 1.9 GB image dataset deliberately kept **outside OneDrive** at `C:\Users\Nakul\bird-data\`
  so it does not sync; the pipeline points at it via `bulk_data_dir` in config

### Where things stand

Done and verified: raw data audit, model selection and quantization, name matching
(524/526), the database and its 21 tables, migration data from GBIF and eBird,
GPS tracking (34 Movebank studies, 708,817 points), species images (11,101 rows),
species summaries (250), richness cell coordinates (18,421/18,421), cleanup, the
notes in this file, and the API (49 endpoints across 8 routers, all smoke-tested,
photo identification verified at 30/30 over HTTP).

Bird sound is in, from **Xeno-canto**, verified end to end against the live
archive — 34/34 checks, a recording streams as real audio, and a 40-species
sample found 92% have sound. Metadata only; the audio is relayed, never stored.
See "Bird sound (Xeno-canto)" above.

Open items, none of them started:

1. **Image licences** — store the per-file licence from Commons `extmetadata`.
   Attribution and source URL are already captured, the licence is not.
2. **Bulk Movebank pull** — the curated 34 studies are the start; about 1,000
   studies have download access. Widening is a one-line change to `CURATED`.
   Watch the rate limit — Movebank 429s under repeated pulls and the client now
   backs off, so a bulk pull should be run patiently.
3. **eBird sampling** — currently one day per region-month, which gives
   presence/absence only. Four days across two years would give a usable
   occupancy curve. `backend/app/ingest/ebird_client.py`.
4. **eBird Status & Trends** — the real fix for weekly abundance maps. Separate
   Cornell product, needs an account; the API key in `.env` does not cover it.

Rebuild everything:

```bash
cd backend && ./.venv/Scripts/python.exe -m app.ingest.run
```

Just the images:

```bash
cd backend && ./.venv/Scripts/python.exe -c "from app.database import SessionLocal; from app.ingest import images; db=SessionLocal(); print(images.load_species_images(db)); db.close()"
```


