/**
 * AI Video Studio Full-Stack Server
 * Integrates Express, Vite middleware, Gemini AI (@google/genai),
 * and Multi-Provider Image Search (Openverse, Wikimedia, Pixabay, Google Images fallback).
 */

import express, { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

import { OpenverseProvider } from "./src/server/providers/openverse.js";
import { WikimediaProvider } from "./src/server/providers/wikimedia.js";
import { PixabayProvider } from "./src/server/providers/pixabay.js";
import { safeFetchImage } from "./src/server/providers/ssrf.js";
import {
  getVisionCapabilities,
  analyzeVoiceSegment,
  rankAndVerifyImages,
  runAiDirector
} from "./src/server/geminiService.js";
import { splitSentenceIntoClauses } from "./src/utils/clauseParser.js";
import { ImageResult } from "./src/types.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ensure upload cache directory exists
const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
await fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});

// Serve uploaded assets
app.use("/uploads", express.static(UPLOADS_DIR));

// Provider instances
const openverse = new OpenverseProvider();
const wikimedia = new WikimediaProvider();
const pixabay = new PixabayProvider();

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", app: "AI Video Studio", time: new Date().toISOString() });
});

app.get("/api/test-env", (_req: Request, res: Response) => {
  res.json({
    hasKey: !!process.env.GEMINI_API_KEY,
    keyVal: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 4) + "..." : null
  });
});

// Vision capabilities check
app.get("/api/vision/capabilities", (_req: Request, res: Response) => {
  res.json(getVisionCapabilities());
});

// App configuration & provider statuses
app.get("/api/config", (_req: Request, res: Response) => {
  res.json({
    pixabayConfigured: !!(process.env.PIXABAY_API_KEY && process.env.PIXABAY_API_KEY.trim()),
    openverseMode: "anonymous_first",
    providers: [
      { id: "openverse", name: "Openverse", status: "ready", mode: "anonymous" },
      { id: "wikimedia", name: "Wikimedia Commons", status: "ready", mode: "public" },
      {
        id: "pixabay",
        name: "Pixabay",
        status: process.env.PIXABAY_API_KEY ? "ready" : "key_required",
        mode: process.env.PIXABAY_API_KEY ? "configured" : "unconfigured"
      },
      { id: "google_manual", name: "Google Images", status: "ready", mode: "manual_fallback" }
    ],
    gemini: {
      provider: "Google Gemini",
      model: "gemini-3.8-flash",
      configured: !!process.env.GEMINI_API_KEY
    }
  });
});

// Multi-Provider Image Search Orchestrator
app.post("/api/images/search", async (req: Request, res: Response) => {
  try {
    const { query, options = {}, providers = ["openverse", "wikimedia", "pixabay"] } = req.body;
    const cleanQuery = typeof query === "string" ? query.trim() : "";

    if (!cleanQuery) {
      res.json({ query: "", results: [], count: 0, providerStatus: {} });
      return;
    }

    const customPixabayKey = (req.headers["x-pixabay-key"] as string) || undefined;
    const providerStatus: Record<string, { ok: boolean; count: number; message?: string }> = {};

    const tasks: Promise<ImageResult[]>[] = [];

    // 1. Openverse
    if (providers.includes("openverse")) {
      tasks.push(
        openverse
          .search(cleanQuery, options)
          .then(res => {
            providerStatus.openverse = { ok: true, count: res.length };
            return res;
          })
          .catch(err => {
            console.warn("[Search Orchestrator] Openverse error:", err);
            providerStatus.openverse = { ok: false, count: 0, message: err.message };
            return [];
          })
      );
    }

    // 2. Wikimedia Commons
    if (providers.includes("wikimedia")) {
      tasks.push(
        wikimedia
          .search(cleanQuery, options)
          .then(res => {
            providerStatus.wikimedia = { ok: true, count: res.length };
            return res;
          })
          .catch(err => {
            console.warn("[Search Orchestrator] Wikimedia error:", err);
            providerStatus.wikimedia = { ok: false, count: 0, message: err.message };
            return [];
          })
      );
    }

    // 3. Pixabay
    if (providers.includes("pixabay")) {
      tasks.push(
        pixabay
          .search(cleanQuery, options, customPixabayKey)
          .then(({ results, configured, message }) => {
            providerStatus.pixabay = {
              ok: configured,
              count: results.length,
              message: !configured ? "Pixabay chưa cấu hình API key." : message
            };
            return results;
          })
          .catch(err => {
            console.warn("[Search Orchestrator] Pixabay error:", err);
            providerStatus.pixabay = { ok: false, count: 0, message: err.message };
            return [];
          })
      );
    }

    const settled = await Promise.allSettled(tasks);
    const combined: ImageResult[] = [];
    const seenUrls = new Set<string>();

    for (const item of settled) {
      if (item.status === "fulfilled" && Array.isArray(item.value)) {
        for (const img of item.value) {
          const normUrl = (img.imageUrl || img.thumbnailUrl || "").toLowerCase();
          if (normUrl && !seenUrls.has(normUrl)) {
            seenUrls.add(normUrl);
            combined.push(img);
          }
        }
      }
    }

    res.json({
      query: cleanQuery,
      count: combined.length,
      results: combined,
      providerStatus
    });
  } catch (err) {
    console.error("[API /api/images/search] Error:", err);
    res.status(500).json({
      error: "Lỗi tìm kiếm hình ảnh",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Voice Segment Analyzer
app.post("/api/gemini/analyze-segment", async (req: Request, res: Response) => {
  try {
    const { text, voiceContext } = req.body;
    console.log("[ROUTE /api/gemini/analyze-segment] Received text:", text);
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Thiếu trường 'text' hợp lệ." });
      return;
    }

    const analysis = await analyzeVoiceSegment(text, voiceContext);
    console.log("[ROUTE /api/gemini/analyze-segment] Analysis done, sending json");
    res.json(analysis);
  } catch (err) {
    console.error("[API /api/gemini/analyze-segment] Error:", err);
    res.status(500).json({
      error: "Không thể phân tích đoạn thoại",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Main & Subordinate Clause Splitter
app.post("/api/gemini/clause-split", (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Thiếu nội dung câu thoại." });
      return;
    }
    const clauses = splitSentenceIntoClauses(text);
    res.json({ clauses });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi phân tách câu chính phụ",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// AI Director (Full Script Breakdown)
app.post("/api/gemini/ai-director", async (req: Request, res: Response) => {
  try {
    const { script } = req.body;
    if (!script || typeof script !== "string") {
      res.status(400).json({ error: "Thiếu nội dung kịch bản." });
      return;
    }
    const scenes = await runAiDirector(script);
    res.json({ scenes });
  } catch (err) {
    console.error("[API /api/gemini/ai-director] Error:", err);
    res.status(500).json({
      error: "Lỗi tạo phân cảnh bằng AI Director",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Multi-Stage AI Vision Image Matching & Verification
app.post("/api/vision/match", async (req: Request, res: Response) => {
  try {
    const { segmentText, visualIntent, candidates = [] } = req.body;
    if (!segmentText || !Array.isArray(candidates)) {
      res.status(400).json({ error: "Tham số không hợp lệ." });
      return;
    }

    const evaluations = await rankAndVerifyImages(
      segmentText,
      visualIntent || segmentText,
      candidates
    );

    res.json({ evaluations });
  } catch (err) {
    console.error("[API /api/vision/match] Error:", err);
    res.status(500).json({
      error: "Lỗi đối soát AI Vision",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Safe Asset Download to Project Storage (SSRF Protected)
app.post("/api/assets/download", async (req: Request, res: Response) => {
  try {
    const { url, name } = req.body;
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Thiếu URL ảnh cần tải về dự án." });
      return;
    }

    const { buffer, contentType } = await safeFetchImage(url, 15 * 1024 * 1024);

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
      ? "webp"
      : "jpg";

    const hash = crypto.randomUUID();
    const filename = `${hash}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    await fs.writeFile(filePath, buffer);

    const localAssetUrl = `/uploads/${filename}`;
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

    res.json({
      assetId: `asset-${hash.slice(0, 8)}`,
      filename: name ? `${name}.${ext}` : filename,
      localAssetUrl,
      dataUrl,
      contentType,
      size: buffer.byteLength,
      importedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("[API /api/assets/download] Error:", err);
    res.status(400).json({
      error: "Không thể lưu ảnh vào dự án",
      message: err instanceof Error ? err.message : "Download failed"
    });
  }
});

// Manual File Upload
app.post("/api/assets/upload", async (req: Request, res: Response) => {
  try {
    const { base64Data, mimeType = "image/jpeg", filename = "upload.jpg" } = req.body;
    if (!base64Data) {
      res.status(400).json({ error: "Thiếu dữ liệu ảnh base64." });
      return;
    }

    const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), "base64");
    if (buffer.byteLength > 10 * 1024 * 1024) {
      res.status(400).json({ error: "Dung lượng tệp vượt quá 10 MB." });
      return;
    }

    const hash = crypto.randomUUID();
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const savedName = `${hash}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, savedName);

    await fs.writeFile(filePath, buffer);

    res.json({
      assetId: `asset-${hash.slice(0, 8)}`,
      filename,
      localAssetUrl: `/uploads/${savedName}`,
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
      contentType: mimeType,
      size: buffer.byteLength
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi tải ảnh lên",
      message: err instanceof Error ? err.message : "Upload error"
    });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serve
// -------------------------------------------------------------
async function startServer() {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[AI Video Studio] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
