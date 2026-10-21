# Birdpedia hosting

Checked against the current project and provider documentation on 21 October 2026.
No cloud resources have been created or deployed.

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
