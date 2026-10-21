import { createClient } from "npm:@supabase/supabase-js@2.106.1";

// Only a one-way digest is stored here. The token itself stays on the API host.
const tokenHash = "efb382905dcbfe4fb87d679a858ce41d7b625ea1a2c9fd65886b256b12cc3f75";
Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const token = req.headers.get("x-snapshot-token") || "";
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (digest !== tokenHash) return new Response("Unauthorized", { status: 401 });
  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const bucket = client.storage.from("birdy-snapshots");
    const { data, error } = await bucket.download("manifest.json");
    if (error || !data) throw new Error("Manifest unavailable");
    const manifest = JSON.parse(await data.text());
    for (const part of manifest.parts) {
      if (!/^birds-[a-f0-9]{12}\.part\d{3}$/.test(part.path)) throw new Error("Invalid snapshot path");
      const result = await bucket.createSignedUrl(part.path, 3600);
      if (result.error || !result.data) throw new Error("Snapshot unavailable");
      part.url = result.data.signedUrl;
    }
    return Response.json(manifest, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("Snapshot unavailable", { status: 503 });
  }
});
