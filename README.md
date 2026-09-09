# Physics Focus

A distraction-free player for @abhayagrawalphysics HCV solution videos only.
Videos are fetched live and auto-sorted into HCV chapters using an AI-assisted
classifier — no manual video-ID entry, no manual chapter tagging required.

## How the restriction is guaranteed

- `api/videos.js` runs on the server (Vercel), never in the browser.
- It resolves the channel handle to a channel ID, then re-checks every single
  video's `channelId` against it — anything that doesn't match is dropped.
- Shorts and non-public videos are filtered out.
- The frontend (`index.html`) only ever calls `/api/videos` and `/api/classify`
  — it never talks to the YouTube Data API, the LLM API, or holds any API key.

## 1. Get a YouTube Data API key

1. Go to https://console.cloud.google.com/ and create a project (or use an existing one).
2. APIs & Services → Library → enable **YouTube Data API v3**.
3. APIs & Services → Credentials → Create Credentials → **API key**.
4. Click the key → **Restrict key**:
   - API restrictions → restrict to **YouTube Data API v3**.
   - (Optional but recommended) Application restrictions → HTTP referrers →
     add your Vercel domain once you have it, e.g. `physics-focus.vercel.app/*`.

## 2. Deploy (Vercel, free)

You don't need to touch a terminal if you'd rather use the website:

1. Push this folder to a GitHub repo (or use Vercel's "Upload" import).
2. Go to https://vercel.com → **Add New → Project** → import the repo.
3. Before deploying, open **Environment Variables** and add all four from
   `.env.example` (see below for where each one comes from).
4. Click **Deploy**. You'll get a URL like `https://physics-focus-yourname.vercel.app`.
5. Bookmark that URL on your tablet/phone — that's your app, works in any browser.

If you prefer the CLI instead:
```
npm i -g vercel
vercel          # first deploy, follow prompts
vercel env add YOUTUBE_API_KEY production
vercel --prod
```

## 3. AI-assisted chapter classification

Videos are matched to an HCV chapter in two stages:

1. **Local keyword match** (instant, free) — checks the title/description for
   explicit "Chapter N" mentions or distinctive chapter-name phrases (e.g.
   "Newton's Laws", "Rest and Motion"). If confident, this is the final answer.
2. **LLM fallback** (Gemini) — only runs when stage 1 is unsure (ambiguous or
   no match). It's sent the title, description, and the fixed 46-chapter HCV
   list — it can only pick from that list, never invent one.

Every result is cached forever (in Upstash Redis) by video ID, so a given
video is only ever sent to the LLM once — later refreshes just reuse the
cached result. Only videos never seen before trigger fresh classification.

**Confidence buckets:**
- ≥ 85% → assigned straight to its chapter
- 60–84% → shown under "Needs Review"
- < 60% → "Other / Uncategorized"

**You can always override:** open a video → use the **Change Chapter**
dropdown to set it manually (that video is never touched by automatic
re-classification again), or hit **↻ Re-classify with AI** to force a fresh
LLM call for just that one video. The header's **🤖 Re-classify uncertain**
button re-runs every non-manual video that isn't already "assigned" — useful
after tweaking the keyword list in `lib/hcv-chapters.js`.

### Extra setup for this feature

**Gemini API key (free)**
- https://aistudio.google.com/apikey → Create API key
- Add as `LLM_API_KEY` in Vercel env vars

**Upstash Redis (free, required for classification caching to persist)**
- https://console.upstash.com → Create Database (pick a region close to your Vercel deployment)
- Copy the **REST URL** and **REST TOKEN** shown on the database page
- Add as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars

Without these two, the app still works — it just falls back to "Other /
Uncategorized" for anything the local keyword match can't confidently place,
and re-runs the local match every 6-hour refresh instead of remembering.

## 4. Using it day-to-day

- First load fetches all videos once and caches them in the browser for 6 hours.
- Tap **⟳ Refresh** in the header any time to pull newly uploaded videos immediately.
- Progress, bookmarks, and theme are stored in `localStorage` — device-local,
  same browser only, no account.

## Files

- `index.html` — the whole frontend (single file, no build step).
- `api/videos.js` — fetches/validates/filters YouTube videos, calls the classifier.
- `api/classify.js` — manual re-classify / change-chapter endpoint.
- `lib/hcv-chapters.js` — the canonical 46-chapter HCV list + keyword aliases.
- `lib/classifier.js` — the two-stage (local + LLM) classification logic.
- `lib/kv.js` — persistent classification cache (Upstash Redis REST client).
- `.env.example` — copy values into Vercel's Environment Variables (see above).
