# Birdpedia hosting

Deployed on 22 October 2026 (India time).

## Live deployment

**Public website: https://birdy-theta-jet.vercel.app**

Visitors open only this link. Vercel forwards `/api/*` to the Python backend;
the frontend uses `/api` without exposing backend credentials.

| Component | Location | Plan |
| --- | --- | --- |
| Frontend | Vercel `birdy`, workspace `nakulf2007-2371s-projects` | Hobby |
| API and classifier | Render `birdy-api`, Birdy project / Production in MyPoke | Free |
| Database snapshot | Supabase `Birdy`, organization `idk`, Mumbai | Free |

The API is `https://birdy-api.onrender.com`. It restores the existing SQLite
database during its build, and serves it alongside the checked-in ONNX model.
Supabase provides private snapshot storage; the SQL query layer remains SQLite.
The compressed snapshot is 72,763,586 bytes, split into two files below the
50 MB free Storage upload limit. The private `deployment-snapshot` function
requires both JWT verification and a separate server-side token, then issues
short-lived read URLs. Its token digest is checked into the function source;
the actual token stays in Render environment variables. The temporary upload
function has been disabled. No anonymous write policies were created.

Render stores `BIRDS_DB_URL`, `BIRDS_DB_SHA256`, `BIRDS_SNAPSHOT_ANON_KEY`,
`BIRDS_SNAPSHOT_TOKEN`, `GOOGLE_KEY` and `XENO_CANTO_KEY` server-side.
Do not copy them into frontend configuration or Git. `.deployment/` and local
environment files are ignored. The database SHA-256 is
`abe7c4e1756acc1be3dc5296ce70645bb2b5bde0ff466e6724ef055c6a251fe9`.

The Render service uses a smaller SQLite cache/pool and a single-threaded ONNX
session for its 512 MB free instance. After inactivity it can sleep; website API
requests wake it automatically. Frontend reads retry temporary gateway failures.
No separate backend browser tab or local server is required.

The Vercel project was deployed with the official CLI because its GitHub app
was not installed for this repository. Source is saved in GitHub, but automatic
Vercel deployment on a Git push is not yet connected. For updates, run
`vercel deploy --prod --scope team_8JPDsYjLcQR9CsjKXcfOTraV` from the repository
root after building locally. The Vercel project root directory is `frountend`.
`.vercelignore` excludes backend data and local credentials from frontend uploads.

Vercel CLI 65.0.0 is installed and signed in. The existing Vercel plugin remains
installed, and the shared `https://mcp.vercel.com` endpoint is configured in the
Codex user configuration with OAuth completed. Newly configured MCP tools may
require a client refresh; the older plugin connection still denied team access,
so deployment used the authenticated CLI fallback.

## Verification

The public homepage returned 200 without sign-in. `/api/health` confirmed the
database and classifier were loaded. All 58 existing API smoke checks passed
through the public Vercel URL. The production frontend build and 10 regression
tests passed. The browser loaded the 32-species Atlas. Private snapshot restore,
checksum validation, unauthorized-access rejection and upload-helper shutdown
were verified; Supabase security advisors returned no findings.

The live photo upload test was not completed because browser upload permission
was declined. The user then confirmed the website was working and requested no
further checks. Local photo classification passed with the hosted memory settings.

## Original deployment reference

The following alternatives and setup notes were researched before deployment.
The live configuration above takes precedence.

## Practical free demo: Vercel frontend + Render API

The frontend is a static Vite build. The backend needs Python, ONNX Runtime,
the 30 MB classifier and the populated 283 MB SQLite database. Keep inference
and the database together on Render; serve the frontend from Vercel or Render's
free static hosting.

1. Publish the intended source to a Git repository, including `models/` and the
   frontend. Do not publish `.env`. The SQLite database is deliberately ignored.
2. Prepare an immutable snapshot of `backend/birds.db` using SQLite's backup API
   while the app is stopped or idle. Host the snapshot at an HTTPS download URL
   available to Render. A GitHub Release asset can hold the file; committing a
   283 MB file directly to GitHub is unsuitable. Check source redistribution
   licences before making a database snapshot public. Some image licences have
   not yet been captured by this project's ingest pipeline.
3. Create a Render Blueprint from `render.yaml`, or a Python Web Service at the
   repository root. Build: `pip install -r backend/requirements-runtime.txt`.
   Start: `python backend/start.py`. Health endpoint: `/health`.
4. Set `BIRDS_DB_URL` to the snapshot URL (SQLite or gzip), and
   `BIRDS_DB_SHA256` to the SHA-256 of the **uncompressed SQLite file**.
   The start script restores the snapshot when it is missing. It does not run
   the multi-source ingest pipeline during deployment.
5. Set backend `CORS_ORIGINS` to the exact frontend origin, for example
   `https://birdpedia.vercel.app`. Set `XENO_CANTO_KEY` for Xeno-canto and
   `GOOGLE_KEY` for optional generated descriptions/vision verification.
   Classifier recognition and factsheet templates work without Google.
6. Import the frontend into Vercel with root directory **`frountend`**, framework
   Vite, build `npm run build`, output `dist`. Set `VITE_API_URL` to the Render
   API origin, without `/api` or a trailing slash. `vercel.json` handles direct
   visits to `/atlas`, `/catalog`, `/flyways` and `/phylogeny`.
7. Verify `/health` reports `database_ok: true` and `model_loaded: true`. Then
   test photo upload, search, a recorded call, map tiles, species selection,
   timeline playback and both WebGL/Sketchfab model viewers from the deployed
   frontend. Check memory during inference before treating the free tier as
   sufficient.

Render's free API sleeps after 15 minutes of inactivity. Local files are
ephemeral, persistent disks require a paid service, and free instances have
512 MB RAM. The database snapshot must be restorable after every replacement;
newly cached audio metadata can be lost. CPU inference, concurrent media proxying
and SQLite caches must be measured under the free memory limit. This is a demo
route, not a claim of verified always-on production hosting.

Sources: [Render free services](https://render.com/docs/free),
[compute plans](https://render.com/docs/compute-plans),
[persistent disks](https://render.com/docs/disks),
[Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite).

## Can everything run on Vercel?

Vercel supports FastAPI/Python, but this backend currently assumes writable
SQLite, keeps media metadata caches and loads an ONNX model. Python functions
have a 500 MB uncompressed bundle limit. The database, model and runtime/native
dependencies need a measured bundle; the current full ingest dependencies add
PyArrow unnecessarily. A writable temporary copy of SQLite is not durable shared
storage. Vercel is a straightforward frontend host here; moving the full API
there requires a storage strategy and deployment/memory verification.

Source: [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python).

## Can Supabase replace the backend?

Supabase is useful for Postgres and file storage, but its Edge Functions use
Deno/TypeScript; they do not directly run this Python ONNX/FastAPI application.
Its free plan currently includes a 500 MB database and 1 GB of object storage.
The 283 MB SQLite file does not prove the PostgreSQL import plus indexes will fit
in 500 MB. Free projects can pause after a week of inactivity. Free Storage also
limits individual file uploads, so check the current file limit before choosing
it for the database snapshot.

A Supabase migration would require porting SQLite-specific SQL (`strftime`,
`group_concat`, bare-column `MIN()` track thinning), configuring an async
Postgres driver, migrating the data, and applying access policies to exposed
tables. Python inference still needs a host. That work is optional for this
release; the frontend fixes do not require a Supabase API key.

Sources: [Supabase pricing](https://supabase.com/pricing),
[Edge Function limits](https://supabase.com/docs/guides/functions/limits),
[function development](https://supabase.com/docs/guides/functions/development-tips),
[Storage upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits).

## Credentials and services

- Map: no API key is needed for the current OpenStreetMap layer. Keep attribution
  visible and respect the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
  Choose a commercial tile provider if traffic outgrows public community tiles.
- Sketchfab: the 30 public museum embeds need no key. Creator, licence and source
  links are displayed. Direct GLB downloads from Sketchfab require its separate
  authenticated Download API; this integration uses the supported viewer embeds.
- Audio: the existing Xeno-canto key remains server-side. During this audit its
  API/download routes returned 503. Exact-species Wikimedia Commons audio is an
  independent, credited fallback; coverage varies by species.
- eBird and Movebank credentials are needed when refreshing their source data,
  not when viewing the existing SQLite occurrence and migration records.
- Deployment: an intended Git repository, connected hosting accounts, the chosen
  frontend/API origins and a restorable database snapshot URL are needed. No
  hosting account credential should be placed in frontend environment variables.
