# Birdpedia

Live website: **[birdy-theta-jet.vercel.app](https://birdy-theta-jet.vercel.app)**.
The frontend and API work through this one link; the free backend can take time
to wake after inactivity. See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting details.

A React bird encyclopedia with photo identification, recorded calls, migration
maps, phylogeny and a 32-species 3D atlas. FastAPI serves the local SQLite research
database and the quantized ONNX classifier.

Run the API from `backend` with
`.venv/Scripts/python.exe -m uvicorn app.main:app --reload`, and the frontend from
`frountend` with `npm run dev`. The frontend uses port 5173 and proxies `/api` to
port 8000. `BIRDPEDIA_API_TARGET` can override the local proxy target;
`VITE_API_URL` sets the deployed API origin.

The populated `backend/birds.db` is required and is intentionally ignored by Git.
Provider credentials belong in the root `.env`; map tiles and public Sketchfab
embeds need no key.

See [deployment options](DEPLOYMENT.md), [verification results](VERIFICATION.md)
and [project history](progress.md).
