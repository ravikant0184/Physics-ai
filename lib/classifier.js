import { HCV_CHAPTERS, HCV_CONTEXT_MARKERS, findChapterById } from "./hcv-chapters.js";
import { kvGet, kvSet } from "./kv.js";

export const CONFIDENCE = { AUTO: 0.85, REVIEW: 0.60 };
const MAX_LLM_CALLS_PER_RUN = 15; // caps latency + cost on any single videos.js refresh

function bucketFor(confidence) {
  if (confidence >= CONFIDENCE.AUTO) return "assigned";
  if (confidence >= CONFIDENCE.REVIEW) return "review";
  return "uncategorized";
}

// ---------- Stage 1: fast local keyword classifier (no network call) ----------
function localClassify(title, description) {
  const text = `${title} ${description || ""}`.toLowerCase();

  // Explicit "Chapter N" is the strongest possible signal.
  const explicit = text.match(/chapter\s*[-:]?\s*(\d+)/i);
  if (explicit) {
    const ch = findChapterById(parseInt(explicit[1], 10));
    if (ch) return { chapterId: ch.id, chapterName: ch.name, confidence: 0.95, reason: `Title explicitly says "Chapter ${ch.id}".`, source: "local" };
  }

  // Otherwise, look for distinctive alias phrases. Track every chapter that
  // matches — if more than one does, the title is ambiguous and we hand it
  // to the LLM rather than guess.
  const hits = [];
  for (const ch of HCV_CHAPTERS) {
    for (const alias of ch.aliases) {
      if (text.includes(alias)) { hits.push({ ch, alias }); break; }
    }
  }

  if (hits.length === 1) {
    const { ch, alias } = hits[0];
    const multiWord = alias.trim().includes(" ");
    const confidence = multiWord ? 0.9 : 0.78;
    return { chapterId: ch.id, chapterName: ch.name, confidence, reason: `Title/description matches "${alias}".`, source: "local" };
  }

  if (hits.length > 1) {
    return { chapterId: null, chapterName: null, confidence: 0.4, reason: `Ambiguous — matched ${hits.map(h => h.ch.name).join(", ")}.`, source: "local" };
  }

  return { chapterId: null, chapterName: null, confidence: 0.15, reason: "No local keyword match.", source: "local" };
}

// ---------- Stage 2: LLM classifier (only called when stage 1 is unsure) ----------
async function llmClassify(title, description) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null; // no key configured yet — caller falls back gracefully

  const chapterList = HCV_CHAPTERS.map((c) => `${c.id}: ${c.name}`).join("\n");
  const prompt = `You are classifying a YouTube video as belonging to one chapter of "Concepts of Physics" by H.C. Verma (HCV), or to none.

The channel makes HCV solution videos. Common ways the creator refers to this: ${HCV_CONTEXT_MARKERS.join(", ")}.

Canonical chapter list (choose ONLY from these ids — never invent a chapter):
${chapterList}

Video title: "${title}"
Video description: "${(description || "").slice(0, 500)}"

Rules:
- If the title/description gives clear, specific evidence for exactly one chapter, return that chapterId with confidence >= 0.85.
- If there's some evidence but it's not fully certain, return confidence between 0.60 and 0.84.
- If there is insufficient evidence, or the video doesn't seem HCV-related at all, return chapterId null, chapterName "Other / Uncategorized", confidence below 0.60, isHCVRelated false. Do NOT guess.

Respond with ONLY this JSON shape, nothing else:
{"chapterId": number|null, "chapterName": string, "confidence": number, "reason": string, "isHCVRelated": boolean}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);

    // Never trust the LLM's id blindly — validate against the canonical list.
    const valid = parsed.chapterId != null && findChapterById(parsed.chapterId);
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    if (!valid) {
      return { chapterId: null, chapterName: "Other / Uncategorized", confidence: Math.min(confidence, 0.59), reason: parsed.reason || "LLM found insufficient evidence.", source: "llm", isHCVRelated: Boolean(parsed.isHCVRelated) };
    }
    return { chapterId: valid.id, chapterName: valid.name, confidence, reason: parsed.reason || "", source: "llm", isHCVRelated: Boolean(parsed.isHCVRelated) };
  } catch (e) {
    return null; // LLM failure is non-fatal — video just stays uncategorized this run
  }
}

// ---------- Orchestration ----------
// Reads/writes the persistent classification cache. Only classifies videos
// that have never been classified before, unless `force` is passed (manual
// re-classify) — this is what keeps LLM calls rare.
export async function classifyBatch(videos, { force = false } = {}) {
  const keys = videos.map((v) => `classify:${v.id}`);
  const existing = force ? {} : await kvGetMany(keys);

  const toClassify = videos.filter((v) => !existing[`classify:${v.id}`]);
  let llmCallsUsed = 0;
  const results = {};

  for (const v of videos) {
    const cached = existing[`classify:${v.id}`];
    if (cached) { results[v.id] = cached; continue; }
    if (results[v.id]) continue;

    const stage1 = localClassify(v.title, v.description);
    let final = stage1;

    if (stage1.confidence < CONFIDENCE.AUTO && llmCallsUsed < MAX_LLM_CALLS_PER_RUN) {
      const stage2 = await llmClassify(v.title, v.description);
      llmCallsUsed++;
      if (stage2) final = stage2;
    }

    final.bucket = bucketFor(final.confidence);
    final.classifiedAt = new Date().toISOString();
    results[v.id] = final;
    await kvSet(`classify:${v.id}`, final);
  }

  return results;
}

async function kvGetMany(keys) {
  // Sequential kvGet is fine at this scale (few hundred videos, once per 6h);
  // swap for kvMGet from lib/kv.js if you want fewer round trips.
  const out = {};
  await Promise.all(keys.map(async (k) => {
    const v = await kvGet(k);
    if (v) out[k] = v;
  }));
  return out;
}

export async function setManualOverride(videoId, chapterId) {
  const ch = findChapterById(chapterId);
  const value = {
    chapterId: ch ? ch.id : null,
    chapterName: ch ? ch.name : "Other / Uncategorized",
    confidence: 1,
    reason: "Manually set.",
    source: "manual",
    isHCVRelated: true,
    bucket: ch ? "assigned" : "uncategorized",
    classifiedAt: new Date().toISOString(),
  };
  await kvSet(`classify:${videoId}`, value);
  return value;
}
