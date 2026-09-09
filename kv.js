// Minimal Upstash Redis REST client — plain fetch calls, no dependency, so the
// project stays a zero-build-step deployment like it already was.
//
// Why this exists: Vercel serverless functions are stateless between cold
// starts — an in-memory object (like the old `let cache = {}` in videos.js)
// gets wiped constantly, which would mean re-classifying every video on every
// cold start. That defeats the whole point of caching LLM results. This gives
// classifications a home that actually survives.
//
// Setup: create a free Redis database at https://console.upstash.com, then
// copy its REST URL + token into Vercel env vars (see README).
//
// Degrades gracefully: if the env vars aren't set yet, every call is a no-op
// (get returns null, set does nothing) — the app keeps working, it just
// re-classifies every refresh until you set this up.

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const kvConfigured = Boolean(URL && TOKEN);

async function call(path) {
  if (!kvConfigured) return null;
  const r = await fetch(`${URL}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = await r.json();
  return j.result;
}

export async function kvGet(key) {
  const raw = await call(`/get/${encodeURIComponent(key)}`);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Batch read — one round trip for many keys instead of N. Upstash MGET.
export async function kvMGet(keys) {
  if (!kvConfigured || keys.length === 0) return {};
  const path = `/mget/${keys.map(encodeURIComponent).join("/")}`;
  const raw = await call(path);
  const out = {};
  if (Array.isArray(raw)) {
    keys.forEach((k, i) => {
      if (raw[i] == null) return;
      try { out[k] = JSON.parse(raw[i]); } catch {}
    });
  }
  return out;
}

export async function kvSet(key, value) {
  if (!kvConfigured) return;
  await fetch(`${URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "text/plain" },
    body: JSON.stringify(value),
  }).catch(() => {});
}
