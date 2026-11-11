/**
 * Pixabay Image Provider Adapter
 * Supports automatic search when PIXABAY_API_KEY is configured.
 * Respects 100 req/60s rate limit, 24h caching, and never halts other providers when unconfigured.
 */

import { ImageResult, SearchOptions } from "../../types.js";
import { queryCache } from "./cache.js";

interface PixabayHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  views: number;
  downloads: number;
  likes: number;
  user_id: number;
  user: string;
  userImageURL: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

export class PixabayProvider {
  readonly id = "pixabay";
  readonly name = "Pixabay";
  enabled = true;

  // Track sliding window rate limit (100 req / 60 seconds)
  private requestTimestamps: number[] = [];
  private readonly maxPerMinute = 95; // buffer below 100

  private canMakeRequest(): boolean {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60000);
    return this.requestTimestamps.length < this.maxPerMinute;
  }

  async search(
    query: string,
    options: SearchOptions = {},
    customApiKey?: string
  ): Promise<{ results: ImageResult[]; configured: boolean; message?: string }> {
    const apiKey = customApiKey || process.env.PIXABAY_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return {
        results: [],
        configured: false,
        message: "Pixabay chưa cấu hình API key. Tiếp tục dùng Openverse và Wikimedia Commons."
      };
    }

    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { results: [], configured: true };
    }

    const limit = Math.min(25, Math.max(5, options.limit || 15));
    const cacheKey = `pixabay:${cleanQuery.toLowerCase()}:${limit}`;

    const cached = queryCache.get<ImageResult[]>(cacheKey);
    if (cached) {
      return { results: cached, configured: true };
    }

    if (!this.canMakeRequest()) {
      console.warn("[Pixabay] Local sliding rate limit reached, returning cached or empty results");
      return {
        results: [],
        configured: true,
        message: "Pixabay đạt giới hạn tần suất yêu cầu (100 req/phút). Đang tạm hoãn."
      };
    }

    const url = new URL("https://pixabay.com/api/");
    url.searchParams.set("key", apiKey.trim());
    url.searchParams.set("q", cleanQuery);
    url.searchParams.set("per_page", String(limit));
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("image_type", "photo");

    if (options.orientation) {
      url.searchParams.set("orientation", options.orientation === "vertical" ? "vertical" : options.orientation === "horizontal" ? "horizontal" : "all");
    }

    try {
      this.requestTimestamps.push(Date.now());
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(6000),
        headers: {
          "Accept": "application/json"
        }
      });

      if (res.status === 429) {
        console.warn("[Pixabay] 429 Rate limit exceeded from API");
        return {
          results: [],
          configured: true,
          message: "Pixabay HTTP 429: Vượt giới hạn yêu cầu từ API."
        };
      }

      if (!res.ok) {
        console.warn(`[Pixabay] HTTP ${res.status}: ${res.statusText}`);
        return {
          results: [],
          configured: true,
          message: `Pixabay API lỗi: HTTP ${res.status}`
        };
      }

      const data: PixabayResponse = await res.json();
      const results: ImageResult[] = (data.hits || []).map(hit => ({
        id: `pixabay-${hit.id}`,
        provider: "pixabay",
        title: hit.tags || "Pixabay Photo",
        thumbnailUrl: hit.previewURL || hit.webformatURL,
        imageUrl: hit.largeImageURL || hit.webformatURL,
        sourcePageUrl: hit.pageURL,
        creator: hit.user,
        creatorUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`,
        license: "Pixabay Content License (Miễn phí thương mại & phi thương mại)",
        licenseUrl: "https://pixabay.com/service/license-summary/",
        attribution: `Ảnh bởi ${hit.user} trên Pixabay`,
        width: hit.imageWidth,
        height: hit.imageHeight,
        tags: hit.tags ? hit.tags.split(",").map(t => t.trim()) : []
      }));

      queryCache.set(cacheKey, results);
      return { results, configured: true };
    } catch (err) {
      console.warn("[Pixabay] Request failed:", err instanceof Error ? err.message : err);
      return {
        results: [],
        configured: true,
        message: err instanceof Error ? err.message : "Pixabay request failed"
      };
    }
  }
}
