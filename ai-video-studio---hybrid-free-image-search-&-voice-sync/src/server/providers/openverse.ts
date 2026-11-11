/**
 * Openverse Image Provider Adapter
 * Primary free image search provider. Anonymous mode first with 429 backoff and 24h caching.
 */

import { ImageResult, SearchOptions } from "../../types.js";
import { queryCache } from "./cache.js";

interface OpenverseImageItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  foreign_landing_url: string;
  creator: string;
  creator_url: string;
  license: string;
  license_version: string;
  license_url: string;
  attribution: string;
  width?: number;
  height?: number;
  tags?: Array<{ name: string }>;
}

interface OpenverseResponse {
  result_count: number;
  page_count: number;
  page_size: number;
  results: OpenverseImageItem[];
}

export class OpenverseProvider {
  readonly id = "openverse";
  readonly name = "Openverse (Creative Commons)";
  enabled = true;

  private userAgent = "AIVideoStudio/2.0 (image-curator; anonymous; support@example.com)";

  async search(query: string, options: SearchOptions = {}): Promise<ImageResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const limit = Math.min(25, Math.max(5, options.limit || 15));
    const page = options.page || 1;
    const cacheKey = `openverse:${cleanQuery.toLowerCase()}:${limit}:${page}`;

    const cached = queryCache.get<ImageResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL("https://api.openverse.org/v1/images/");
    url.searchParams.set("q", cleanQuery);
    url.searchParams.set("page_size", String(limit));
    url.searchParams.set("page", String(page));
    if (options.orientation) {
      url.searchParams.set("aspect_ratio", options.orientation === "vertical" ? "tall" : options.orientation === "horizontal" ? "wide" : "square");
    }

    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(6000),
          headers: {
            "User-Agent": this.userAgent,
            "Accept": "application/json"
          }
        });

        if (res.status === 429) {
          retries++;
          if (retries > maxRetries) {
            console.warn("[Openverse] Rate limit 429 exceeded after retries");
            return [];
          }
          const retryAfter = Number(res.headers.get("retry-after")) || 1.5;
          await new Promise(r => setTimeout(r, retryAfter * 1000 * Math.pow(2, retries)));
          continue;
        }

        if (!res.ok) {
          console.warn(`[Openverse] HTTP ${res.status}: ${res.statusText}`);
          return [];
        }

        const data: OpenverseResponse = await res.json();
        const results: ImageResult[] = (data.results || []).map(item => ({
          id: `openverse-${item.id}`,
          provider: "openverse",
          title: item.title || "Creative Commons Image",
          thumbnailUrl: item.thumbnail || item.url,
          imageUrl: item.url,
          sourcePageUrl: item.foreign_landing_url || item.url,
          creator: item.creator || "Unknown creator",
          creatorUrl: item.creator_url,
          license: item.license ? `${item.license.toUpperCase()} ${item.license_version || ""}`.trim() : "Creative Commons",
          licenseUrl: item.license_url,
          attribution: item.attribution,
          width: item.width,
          height: item.height,
          tags: item.tags?.map(t => t.name)
        }));

        queryCache.set(cacheKey, results);
        return results;
      } catch (err) {
        console.warn("[Openverse] Request failed:", err instanceof Error ? err.message : err);
        return [];
      }
    }

    return [];
  }
}
