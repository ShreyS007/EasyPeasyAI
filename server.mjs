/**
 * EasyPeasyAI backend
 * - POST /api/generate: Gemini JSON generation
 * - GET /api/search-image?q=...: relevant Wikimedia Commons image retrieval
 *
 * Required .env:
 *   GEMINI_API_KEY=your_key_here
 * Optional:
 *   GEMINI_MODEL=gemini-3.5-flash-lite
 *   PORT=3001
 */
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const allowedOrigins = [
  "http://localhost:5173",
  "https://easypeasyai.onrender.com",
  "https://easypeasyai-frontend.onrender.com"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  }
}));

app.use(express.json({ limit: "2mb" }));

const cleanHtml = (value = "") =>
  String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#160;/g, " ")
    .trim();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "EasyPeasyAI API" });
});

/**
 * Keeps the existing React contract: { prompt } -> { text }.
 * JSON mode makes the requested structured response much more reliable.
 */
app.post("/api/generate", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing. Add it to the backend .env file."
      });
    }

    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
    if (!prompt.trim()) {
      return res.status(400).json({ error: "A non-empty prompt is required." });
    }

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    const payload = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      const message =
        payload?.error?.message || `Gemini request failed (${geminiResponse.status}).`;
      console.error("Gemini API error:", geminiResponse.status, message);
      return res.status(geminiResponse.status).json({ error: message });
    }

    const text =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") || "";

    if (!text) {
      return res.status(502).json({ error: "Gemini returned an empty response." });
    }

    return res.json({ text });
  } catch (error) {
    console.error("Gemini generation error:", error);
    return res.status(500).json({ error: "Unable to generate the explanation right now." });
  }
});

const USER_AGENT =
  "EasyPeasyAI/1.0 (educational image retrieval; contact: project maintainer)";

async function searchCommons(searchTerm) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: searchTerm,
    gsrnamespace: "6",
    gsrlimit: "30",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "1000",
    iiextmetadatalanguage: "en",
    iiextmetadatafilter:
      "Artist|Credit|LicenseShortName|LicenseUrl|ImageDescription"
  });

  const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Wikimedia returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return Object.values(data?.query?.pages || {});
}

function topicTokens(query) {
  const stopWords = new Set([
    "what", "is", "are", "the", "a", "an", "how", "why", "explain",
    "working", "of", "for", "and", "in", "on", "with", "basics",
    "introduction", "overview", "process", "system"
  ]);
  return query.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function scoreImage(page, queryTokens) {
  const title = String(page?.title || "").replace(/^File:/, "").toLowerCase();
  const info = page?.imageinfo?.[0] || {};
  const metadata = info.extmetadata || {};
  const description = cleanHtml(metadata.ImageDescription?.value || "").toLowerCase();
  const searchableTitle = title.replace(/[_-]/g, " ");

  let score = 0;
  for (const token of queryTokens) {
    if (searchableTitle.includes(token)) score += 5;
    else if (description.includes(token)) score += 1;
  }

  // Educational diagrams and labeled illustrations are generally more useful
  // than unrelated photographs for a study explanation.
  if (/\b(diagram|illustration|scheme|structure|cycle|process|mechanism|educational)\b/i.test(title)) {
    score += 3;
  }
  if (/\b(map|satellite|seawifs|biosphere|landcover|earth observation)\b/i.test(title)) {
    score -= 5;
  }
  return score;
}

/**
 * Search the exact topic first, then a diagram-oriented variant. Merge,
 * relevance-rank and return only images with a meaningful topic match.
 */
app.get("/api/search-image", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim().slice(0, 180);
    if (!query) {
      return res.status(400).json({ error: "Query parameter q is required." });
    }

    const tokens = topicTokens(query);
    const searches = [
      query,
      `${query} diagram`
    ];

    const pageMap = new Map();
    for (const searchTerm of searches) {
      const pages = await searchCommons(searchTerm);
      for (const page of pages) {
        if (page?.pageid) pageMap.set(page.pageid, page);
      }
    }

    const images = [...pageMap.values()]
      .map((page) => {
        const info = page?.imageinfo?.[0];
        if (!info?.url || !info?.descriptionurl) return null;
        if (!String(info.mime || "").startsWith("image/")) return null;

        const metadata = info.extmetadata || {};
        const title = String(page.title || "").replace(/^File:/, "");
        const description = cleanHtml(metadata.ImageDescription?.value || "");
        const score = scoreImage(page, tokens);

        // Avoid images whose title and description have no connection to the topic.
        if (tokens.length && score < 1) return null;

        return {
          url: info.url,
          thumbUrl: info.thumburl || info.url,
          title,
          description,
          descriptionUrl: info.descriptionurl,
          artist: cleanHtml(metadata.Artist?.value || metadata.Credit?.value || ""),
          license: cleanHtml(metadata.LicenseShortName?.value || metadata.UsageTerms?.value || ""),
          licenseUrl: cleanHtml(metadata.LicenseUrl?.value || ""),
          relevanceScore: score
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 4)
      .map(({ relevanceScore, ...image }) => image);

    return res.json({ images, source: "Wikimedia Commons", query });
  } catch (error) {
    console.error("Wikimedia image search error:", error);
    return res.status(502).json({
      error: "Unable to search Wikimedia Commons right now.",
      detail: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EasyPeasyAI backend running on port ${PORT}`);
});