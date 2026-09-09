// Vercel serverless function — runs on the server, never in the browser.
// The API key lives only in an environment variable (see .env.example).
//
// What it does:
//   1. Resolves @abhayagrawalphysics to its channel ID (the source of truth).
//   2. Pages through the channel's uploads playlist.
//   3. For every video, re-checks that its channelId matches — anything
//      that somehow didn't come from this channel is dropped.
//   4. Drops Shorts (<=60s) and non-public videos.
//   5. Classifies each into an HCV chapter (local keyword match first, LLM
//      fallback only when uncertain — see lib/classifier.js). Never-before-
//      seen videos are the only ones that ever trigger a fresh classification.

import { classifyBatch } from "../lib/classifier.js";
import { findChapterById } from "../lib/hcv-chapters.js";

const HANDLE = "abhayagrawalphysics";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours, keeps API quota usage tiny
let cache = { data: null, at: 0 };

function parseISODuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
  const h = parseInt(m[1] || 0, 10), mi = parseInt(m[2] || 0, 10), s = parseInt(m[3] || 0, 10);
  return h * 3600 + mi * 60 + s;
}

async function fetchJson(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "YouTube API error");
  return j;
}

export default async function handler(req, res) {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "YOUTUBE_API_KEY is not set on the server." });
  }

  if (cache.data && Date.now() - cache.at < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(cache.data);
  }

  try {
    // 1. Handle -> channel ID + uploads playlist
    const chData = await fetchJson(
      `https://www.googleapis.com/youtube/v3/channels?part=id,contentDetails&forHandle=${HANDLE}&key=${API_KEY}`
    );
    const channel = chData.items && chData.items[0];
    if (!channel) return res.status(404).json({ error: `Channel @${HANDLE} not found.` });
    const channelId = channel.id;
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    // 2. Page through every upload
    let raw = [];
    let pageToken = "";
    do {
      const pl = await fetchJson(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`
      );
      for (const item of pl.items || []) {
        // 3. Validation guard: only accept items whose channelId matches exactly
        if (item.snippet.channelId !== channelId) continue;
        raw.push({
          id: item.contentDetails.videoId,
          title: item.snippet.title,
          description: item.snippet.description || "",
          publishedAt: item.snippet.publishedAt,
        });
      }
      pageToken = pl.nextPageToken || "";
    } while (pageToken && raw.length < 1000);

    // 4. Drop Shorts / non-public videos (needs videos.list for duration+status, batched by 50)
    const filtered = [];
    for (let i = 0; i < raw.length; i += 50) {
      const batch = raw.slice(i, i + 50);
      const ids = batch.map((v) => v.id).join(",");
      const vData = await fetchJson(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status&id=${ids}&key=${API_KEY}`
      );
      for (const v of vData.items || []) {
        const dur = parseISODuration(v.contentDetails.duration);
        if (dur > 60 && v.status.privacyStatus === "public") {
          const orig = batch.find((b) => b.id === v.id);
          filtered.push({ ...orig, durationSeconds: dur });
        }
      }
    }

    // 5. Classify each video into an HCV chapter. Cached results (from a
    // persistent store, see lib/kv.js) are reused as-is — only videos never
    // classified before actually run the classifier. See lib/classifier.js.
    const classifications = await classifyBatch(filtered);

    const chapterBuckets = {}; // chapterId -> videos[]
    const review = [];
    const uncategorized = [];
    for (const v of filtered) {
      const c = classifications[v.id] || { bucket: "uncategorized", chapterId: null };
      const withClass = { ...v, classification: c };
      if (c.bucket === "assigned" && c.chapterId != null) {
        (chapterBuckets[c.chapterId] = chapterBuckets[c.chapterId] || []).push(withClass);
      } else if (c.bucket === "review") {
        review.push(withClass);
      } else {
        uncategorized.push(withClass);
      }
    }

    const chapters = Object.keys(chapterBuckets)
      .map(Number)
      .sort((a, b) => a - b)
      .map((num) => {
        const ch = findChapterById(num);
        return { id: "ch" + num, title: `Chapter ${num} — ${ch ? ch.name : ""}`, videos: chapterBuckets[num] };
      });
    if (review.length) chapters.push({ id: "review", title: "Needs Review", videos: review });
    if (uncategorized.length) chapters.push({ id: "uncat", title: "Other / Uncategorized", videos: uncategorized });

    const payload = { channelId, channelHandle: HANDLE, chapters, fetchedAt: new Date().toISOString() };
    cache = { data: payload, at: Date.now() };

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
