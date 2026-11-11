/**
 * Gemini AI Service (Server-side @google/genai)
 * Reuses existing AI provider (gemini-3.8-flash).
 * Implements capability check, voice segment analysis, clause segmentation,
 * AI Director, and multi-stage visual verification with metadata fallback.
 */

import { GoogleGenAI, Type } from "@google/genai";
import {
  MatchScoreBreakdown,
  SegmentAnalysis,
  VisionCapabilities,
  ClauseSegment
} from "../types.js";
import { safeFetchImage } from "./providers/ssrf.js";
import { splitSentenceIntoClauses, extractKeywords, generateHeadline } from "../utils/clauseParser.js";

// Initialize server-side Gemini client with recommended telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});

const VISION_MODEL = "gemini-3.8-flash";

function hasValidApiKey(): boolean {
  const k = process.env.GEMINI_API_KEY;
  return !!(k && k.trim() && k !== "MY_GEMINI_API_KEY");
}

export function getVisionCapabilities(): VisionCapabilities {
  const isKeyConfigured = hasValidApiKey();
  return {
    supportsImageInput: true,
    supportsMultipleImages: true,
    supportsStructuredOutput: true,
    model: VISION_MODEL,
    provider: isKeyConfigured ? "Google Gemini (@google/genai)" : "Local Rules + Metadata Fallback"
  };
}

export async function analyzeVoiceSegment(
  text: string,
  _voiceContext?: { start?: number; end?: number }
): Promise<SegmentAnalysis> {
  const fallbackClauses = splitSentenceIntoClauses(text);
  const fallbackQueries = [
    text.replace(/[.,!?;:]+$/g, "").split(/\s+/).slice(0, 8).join(" "),
    fallbackClauses.find(c => c.type === "main")?.text || "",
    ...extractKeywords(text, 5).map(k => k.text)
  ].filter(Boolean).slice(0, 4);

  if (!hasValidApiKey()) {
    return {
      ai: false,
      subject: fallbackClauses.find(c => c.type === "main")?.text || text.split(/\s+/).slice(0, 4).join(" "),
      action: "Minh họa nội dung lời thoại",
      environment: "Bối cảnh liên quan",
      intent: text,
      queries: fallbackQueries,
      clauses: fallbackClauses
    };
  }

  try {
    const prompt = `Bạn là Voice Segment Analyzer cho AI Video Studio.
Phân tích đoạn thoại sau để tìm hình ảnh minh họa chân thực, chính xác và phân tách mệnh đề câu chính phụ rõ ràng.

Đoạn thoại: "${text}"

Yêu cầu:
1. Phân tách câu thành:
   - Mệnh đề chính (câu chính / main clause): ý chính, hành động hoặc kết quả cốt lõi.
   - Mệnh đề phụ (câu phụ / subordinate clause): điều kiện, thời gian, nguyên nhân, mục đích, nhượng bộ, hoặc bổ ngữ (nếu có).
2. Trích xuất:
   - Chủ thể chính (subject)
   - Chủ thể phụ (secondary)
   - Thực thể / Tên riêng / Thương hiệu (entities) - giữ nguyên văn
   - Hành động trực quan (action)
   - Đồ vật trọng tâm (object)
   - Bối cảnh / Môi trường (environment)
   - Ý đồ hình ảnh cần thấy (visual_intent)
   - Cảm xúc / Tông giọng (emotion)
   - Mức độ quan trọng (importance: high/medium/low)
3. Tạo 3-5 search queries tìm ảnh trên Openverse, Wikimedia và Pixabay:
   - Query 1: Chủ thể chính + hành động cụ thể (tiếng Việt & tiếng Anh).
   - Query 2: Đồ vật + bối cảnh môi trường.
   - Query 3: Thực thể / chủ đề chính.
   - Query 4: Ngữ cảnh hình ảnh.
   - Query 5: Bản tiếng Anh tương đương chất lượng cao để tìm kiếm quốc tế.

Chỉ trả về JSON theo schema quy định.`;

    const geminiCall = ai.models.generateContent({
      model: VISION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            secondary: { type: Type.STRING },
            entities: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            action: { type: Type.STRING },
            object: { type: Type.STRING },
            environment: { type: Type.STRING },
            visual_intent: { type: Type.STRING },
            emotion: { type: Type.STRING },
            importance: { type: Type.STRING },
            queries: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            clauses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  type: { type: Type.STRING },
                  role: { type: Type.STRING }
                },
                required: ["id", "text", "type", "role"]
              }
            }
          },
          required: ["subject", "action", "visual_intent", "queries"]
        }
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout 8s")), 8000)
    );

    const response = await Promise.race([geminiCall, timeoutPromise]);

    const parsed = JSON.parse(response.text || "{}");
    const queries = Array.isArray(parsed.queries) && parsed.queries.length > 0
      ? parsed.queries.slice(0, 5)
      : fallbackQueries;

    const clauses: ClauseSegment[] = Array.isArray(parsed.clauses) && parsed.clauses.length > 0
      ? parsed.clauses.map((c: { id?: string; text?: string; type?: string; role?: string }, i: number) => ({
          id: c.id || `c-${i + 1}`,
          text: c.text || "",
          type: (c.type === "subordinate" ? "subordinate" : "main") as "main" | "subordinate",
          role: c.role || (c.type === "subordinate" ? "Mệnh đề phụ" : "Mệnh đề chính")
        }))
      : fallbackClauses;

    return {
      ai: true,
      subject: parsed.subject || "",
      secondary: parsed.secondary || "",
      entities: parsed.entities || [],
      action: parsed.action || "",
      object: parsed.object || "",
      environment: parsed.environment || "",
      intent: parsed.visual_intent || "",
      emotion: parsed.emotion || "",
      importance: parsed.importance || "medium",
      queries,
      clauses
    };
  } catch (err) {
    console.warn("[Gemini] analyzeVoiceSegment fallback to local rules:", err instanceof Error ? err.message : err);
    return {
      ai: false,
      queries: fallbackQueries,
      clauses: fallbackClauses
    };
  }
}

/**
 * Multi-Stage Visual Verification Engine
 * Fetches thumbnail buffers safely and feeds to gemini-3.8-flash for vision assessment.
 * Falls back to metadata-only relevance scoring if image cannot be downloaded or vision fails.
 */
export async function rankAndVerifyImages(
  segmentText: string,
  visualIntent: string,
  candidates: Array<{
    id: string;
    title: string;
    thumbnailUrl: string;
    description?: string;
    tags?: string[];
  }>
): Promise<
  Record<
    string,
    {
      scoreBreakdown: MatchScoreBreakdown;
      matchMethod: "vision_verified" | "metadata_only";
    }
  >
> {
  const results: Record<
    string,
    {
      scoreBreakdown: MatchScoreBreakdown;
      matchMethod: "vision_verified" | "metadata_only";
    }
  > = {};

  if (!candidates.length) return results;

  if (!hasValidApiKey()) {
    for (const cand of candidates) {
      results[cand.id] = {
        matchMethod: "metadata_only",
        scoreBreakdown: computeMetadataRelevance(segmentText, cand)
      };
    }
    return results;
  }

  // Process leading candidate images (up to 5 in parallel to optimize latency and bandwidth)
  const batch = candidates.slice(0, 5);
  const remaining = candidates.slice(5);

  // Attempt vision verification on batch
  for (const cand of batch) {
    let verified = false;

    try {
      if (cand.thumbnailUrl && (cand.thumbnailUrl.startsWith("http://") || cand.thumbnailUrl.startsWith("https://"))) {
        const { buffer, contentType } = await safeFetchImage(cand.thumbnailUrl, 5 * 1024 * 1024, 6000);
        const base64Data = buffer.toString("base64");

        const prompt = `Bạn là hệ thống AI Vision Matching cho video studio.
Hãy đánh giá mức độ phù hợp giữa hình ảnh này và nội dung câu thoại của video.

Câu thoại: "${segmentText}"
Ý đồ hình ảnh cần minh hoạ: "${visualIntent || segmentText}"
Tiêu đề tệp ảnh: "${cand.title}"
Mô tả ảnh: "${cand.description || ""}"

Tiêu chí chấm điểm (Tổng 100 điểm):
1. Độ chính xác của chủ thể chính (subjectScore: 0 đến 30 điểm).
2. Độ chính xác của hành động được thể hiện (actionScore: 0 đến 25 điểm).
3. Bối cảnh và môi trường phù hợp (contextScore: 0 đến 20 điểm).
4. Độ chính xác của thực thể / đồ vật xuất hiện (entityScore: 0 đến 15 điểm).
5. Bố cục, chất lượng thẩm mỹ và tính khả dụng làm minh họa video (compositionScore: 0 đến 10 điểm).
6. Hình ảnh có mâu thuẫn trực tiếp với lời nói không? (contradiction: boolean)
7. Hình ảnh có gây hiểu lầm hoặc lạc đề không? (misleading: boolean)
8. Lý do cụ thể vì sao ảnh phù hợp hoặc chưa phù hợp (reason: 1-2 câu ngắn gọn).

LƯU Ý:
- Điểm tổng = subjectScore + actionScore + contextScore + entityScore + compositionScore.
- Nếu ảnh mâu thuẫn hoặc gây hiểu lầm, trừ điểm nặng hoặc cho dưới 50.
- Đánh giá khách quan dựa trên hình ảnh thật. Không suy diễn danh tính người khi không có căn cứ.
Chỉ trả về JSON theo schema quy định.`;

        const imagePart = {
          inlineData: {
            mimeType: contentType,
            data: base64Data
          }
        };

        const visionCall = ai.models.generateContent({
          model: VISION_MODEL,
          contents: {
            parts: [imagePart, { text: prompt }]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                subjectScore: { type: Type.NUMBER },
                actionScore: { type: Type.NUMBER },
                contextScore: { type: Type.NUMBER },
                entityScore: { type: Type.NUMBER },
                compositionScore: { type: Type.NUMBER },
                totalScore: { type: Type.NUMBER },
                contradiction: { type: Type.BOOLEAN },
                misleading: { type: Type.BOOLEAN },
                reason: { type: Type.STRING }
              },
              required: [
                "subjectScore",
                "actionScore",
                "contextScore",
                "entityScore",
                "compositionScore",
                "totalScore",
                "reason"
              ]
            }
          }
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Vision timeout 6s")), 6000)
        );

        const res = await Promise.race([visionCall, timeoutPromise]);
        const parsed = JSON.parse(res.text || "{}");
        const totalScore = Math.min(
          100,
          Math.max(
            0,
            Math.round(
              parsed.totalScore ??
                ((parsed.subjectScore || 0) +
                  (parsed.actionScore || 0) +
                  (parsed.contextScore || 0) +
                  (parsed.entityScore || 0) +
                  (parsed.compositionScore || 0))
            )
          )
        );

        results[cand.id] = {
          matchMethod: "vision_verified",
          scoreBreakdown: {
            subjectScore: Math.min(30, Math.max(0, Math.round(parsed.subjectScore || 0))),
            actionScore: Math.min(25, Math.max(0, Math.round(parsed.actionScore || 0))),
            contextScore: Math.min(20, Math.max(0, Math.round(parsed.contextScore || 0))),
            entityScore: Math.min(15, Math.max(0, Math.round(parsed.entityScore || 0))),
            compositionScore: Math.min(10, Math.max(0, Math.round(parsed.compositionScore || 0))),
            totalScore,
            contradiction: !!parsed.contradiction,
            misleading: !!parsed.misleading,
            reason: parsed.reason || "AI Vision xác thực đối soát hình ảnh."
          }
        };
        verified = true;
      }
    } catch (e) {
      console.warn(`[Gemini Vision] Image verification failed for ${cand.id}:`, e instanceof Error ? e.message : e);
    }

    if (!verified) {
      results[cand.id] = {
        matchMethod: "metadata_only",
        scoreBreakdown: computeMetadataRelevance(segmentText, cand)
      };
    }
  }

  // Compute metadata relevance for remaining candidates
  for (const cand of remaining) {
    results[cand.id] = {
      matchMethod: "metadata_only",
      scoreBreakdown: computeMetadataRelevance(segmentText, cand)
    };
  }

  return results;
}

/**
 * Pure local metadata-only relevance scoring fallback
 */
function computeMetadataRelevance(
  segmentText: string,
  cand: { title: string; description?: string; tags?: string[] }
): MatchScoreBreakdown {
  const normText = segmentText.toLowerCase();
  const textWords = normText.split(/\s+/).filter(w => w.length >= 3);

  const candMeta = `${cand.title} ${cand.description || ""} ${(cand.tags || []).join(" ")}`.toLowerCase();

  let matches = 0;
  textWords.forEach(w => {
    if (candMeta.includes(w)) matches++;
  });

  const ratio = matches / Math.max(1, Math.min(textWords.length, 6));
  const totalScore = Math.min(88, Math.max(35, Math.round(40 + ratio * 48)));

  return {
    subjectScore: Math.round(totalScore * 0.3),
    actionScore: Math.round(totalScore * 0.25),
    contextScore: Math.round(totalScore * 0.2),
    entityScore: Math.round(totalScore * 0.15),
    compositionScore: Math.round(totalScore * 0.1),
    totalScore,
    contradiction: false,
    misleading: false,
    reason: `Đánh giá sơ bộ qua từ khoá và tiêu đề tệp (${matches} từ khớp). Chưa qua AI Vision đối soát.`
  };
}

function runRuleBasedDirector(script: string) {
  const fallback = script
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map(t => t.trim())
    .filter(Boolean);

  return fallback.map((text, i, arr) => {
    const dur = Math.max(3.5, Math.min(8, Math.ceil(text.length / 5) * 0.5));
    const clauses = splitSentenceIntoClauses(text);
    const keywords = extractKeywords(text, dur);
    const headline = generateHeadline(text, i === 0 ? "INTRO" : i === arr.length - 1 ? "OUTRO" : `SCENE ${i + 1}`, keywords);
    return {
      title: i === 0 ? "INTRO" : i === arr.length - 1 ? "OUTRO" : `SCENE ${i + 1}`,
      text,
      narration: text,
      durationSeconds: dur,
      template: i === arr.length - 1 ? "end-card" : "feature-card",
      accent: ["#a78bfa", "#38bdf8", "#f59e0b", "#34d399", "#fb7185"][i % 5],
      headline,
      clauses,
      keywords: keywords.map(k => ({
        text: k.text,
        style: k.style,
        startSeconds: k.start,
        endSeconds: k.end
      }))
    };
  });
}

/**
 * AI Director for full script breakdown with clause segmentation
 */
export async function runAiDirector(script: string) {
  if (!hasValidApiKey()) {
    return runRuleBasedDirector(script);
  }

  const fallback = script
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map(t => t.trim())
    .filter(Boolean);

  try {
    const prompt = `Bạn là AI Director chuyên nghiệp của studio video motion graphics phong cách LuanCut Editorial.
Chia kịch bản sau thành các cảnh video súc tích, mỗi cảnh thể hiện một ý trọn vẹn, có phân tách rõ ràng câu chính (mệnh đề chính) và câu phụ (mệnh đề bổ trợ/dẫn dắt).

KỊCH BẢN:
"""
${script}
"""

Quy tắc:
1. Chia thành 3 đến 12 cảnh tuỳ độ dài kịch bản. Cảnh đầu là INTRO, cảnh cuối là END-CARD/OUTRO.
2. Với mỗi cảnh:
   - title: tối đa 3 từ (VD: "INTRO", "BÍ QUYẾT", "HÀNH ĐỘNG", "KẾT QUẢ", "OUTRO")
   - text: lời thoại/phụ đề nguyên văn, giữ đúng ý tác giả
   - narration: lời đọc diễn cảm
   - durationSeconds: thời lượng từ 3.5 đến 8 giây
   - headline: { small: "dòng dẫn ngắn", main: "từ khoá lớn ấn tượng 1-4 từ", tag: "nhãn danh mục hoặc rỗng" }
   - clauses: phân tách text của cảnh thành danh sách [{ id, text, type: "main"|"subordinate", role: "Ý chính | Thời gian | Điều kiện | Kết quả" }]
   - keywords: 1-3 từ khoá đắt giá có trong text với style:
     * "editorial": từ khoá cốt lõi quan trọng nhất (bút highlight vàng)
     * "ocean": từ khoá phụ (gạch chân xanh đại dương)
     * "number": số liệu, %, thời gian (pill làm nổi bật số)
     * "glass": thương hiệu, thuật ngữ, công cụ (thẻ mờ)
   - template: "kinetic-title" | "feature-card" | "quote" | "end-card"
   - accent: mã màu hex (#a78bfa, #38bdf8, #f59e0b, #34d399, #fb7185)

Chỉ trả JSON theo schema.`;

    const res = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  text: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  durationSeconds: { type: Type.NUMBER },
                  template: { type: Type.STRING },
                  accent: { type: Type.STRING },
                  headline: {
                    type: Type.OBJECT,
                    properties: {
                      small: { type: Type.STRING },
                      main: { type: Type.STRING },
                      tag: { type: Type.STRING }
                    },
                    required: ["small", "main"]
                  },
                  clauses: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        text: { type: Type.STRING },
                        type: { type: Type.STRING },
                        role: { type: Type.STRING }
                      },
                      required: ["id", "text", "type", "role"]
                    }
                  },
                  keywords: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        style: { type: Type.STRING },
                        startSeconds: { type: Type.NUMBER },
                        endSeconds: { type: Type.NUMBER }
                      },
                      required: ["text", "style"]
                    }
                  }
                },
                required: ["title", "text", "durationSeconds", "template", "accent"]
              }
            }
          },
          required: ["scenes"]
        }
      }
    });

    const parsed = JSON.parse(res.text || "{}");
    if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
      return parsed.scenes;
    }
    throw new Error("Empty scenes returned");
  } catch (err) {
    console.warn("[Gemini] AI Director fallback to rule-based split:", err instanceof Error ? err.message : err);
    return fallback.map((text, i, arr) => {
      const dur = Math.max(3.5, Math.min(8, Math.ceil(text.length / 5) * 0.5));
      const clauses = splitSentenceIntoClauses(text);
      const keywords = extractKeywords(text, dur);
      const headline = generateHeadline(text, i === 0 ? "INTRO" : i === arr.length - 1 ? "OUTRO" : `SCENE ${i + 1}`, keywords);
      return {
        title: i === 0 ? "INTRO" : i === arr.length - 1 ? "OUTRO" : `SCENE ${i + 1}`,
        text,
        narration: text,
        durationSeconds: dur,
        template: i === arr.length - 1 ? "end-card" : "feature-card",
        accent: ["#a78bfa", "#38bdf8", "#f59e0b", "#34d399", "#fb7185"][i % 5],
        headline,
        clauses,
        keywords: keywords.map(k => ({
          text: k.text,
          style: k.style,
          startSeconds: k.start,
          endSeconds: k.end
        }))
      };
    });
  }
}
