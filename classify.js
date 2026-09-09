// Manual controls over classification — never runs automatically.
//   POST { action: "reclassify", videoId, title, description }
//     -> force a fresh LLM classification for one video (bypasses cache)
//   POST { action: "reclassify-uncertain", videos: [{id,title,description,classification}] }
//     -> re-run only videos currently in "review" or "uncategorized" and not manually set
//   POST { action: "override", videoId, chapterId }
//     -> you pick the chapter yourself; stored as source "manual" and never
//        touched again by automatic refreshes
import { classifyBatch, setManualOverride } from "../lib/classifier.js";
import { kvSet } from "../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { action } = body;

  try {
    if (action === "reclassify") {
      const { videoId, title, description } = body;
      if (!videoId || !title) return res.status(400).json({ error: "videoId and title required" });
      // Clear any cached result first so classifyBatch treats it as new.
      await kvSet(`classify:${videoId}`, null);
      const result = await classifyBatch([{ id: videoId, title, description }], { force: true });
      return res.status(200).json({ classification: result[videoId] });
    }

    if (action === "reclassify-uncertain") {
      const videos = (body.videos || []).filter(
        (v) => v.classification && v.classification.source !== "manual" && v.classification.bucket !== "assigned"
      );
      for (const v of videos) await kvSet(`classify:${v.id}`, null);
      const results = await classifyBatch(videos, { force: true });
      return res.status(200).json({ classifications: results, count: videos.length });
    }

    if (action === "override") {
      const { videoId, chapterId } = body;
      if (!videoId) return res.status(400).json({ error: "videoId required" });
      const result = await setManualOverride(videoId, chapterId === "" ? null : Number(chapterId));
      return res.status(200).json({ classification: result });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
