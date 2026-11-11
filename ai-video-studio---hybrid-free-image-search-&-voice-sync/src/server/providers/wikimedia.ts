/**
 * Wikimedia Commons Image Provider Adapter
 * Uses MediaWiki public API with selective metadata retrieval and 24h caching.
 */

import { ImageResult, SearchOptions } from "../../types.js";
import { queryCache } from "./cache.js";

interface WikiImageInfo {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  width?: number;
  height?: number;
  mime?: string;
  extmetadata?: {
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
    License?: { value?: string };
    LicenseUrl?: { value?: string };
    Credit?: { value?: string };
    ObjectName?: { value?: string };
    ImageDescription?: { value?: string };
  };
}

interface WikiPage {
  pageid: number;
  title: string;
  imageinfo?: WikiImageInfo[];
}

interface WikiQueryResponse {
  query?: {
    pages?: Record<string, WikiPage>;
  };
}

export class WikimediaProvider {
  readonly id = "wikimedia";
  readonly name = "Wikimedia Commons";
  enabled = true;

  private userAgent = "AIVideoStudio/2.0 (Wikimedia-image-curator; contact: support@example.com)";

  async search(query: string, options: SearchOptions = {}): Promise<ImageResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const limit = Math.min(25, Math.max(5, options.limit || 15));
    const cacheKey = `wikimedia:${cleanQuery.toLowerCase()}:${limit}`;

    const cached = queryCache.get<ImageResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrnamespace", "6"); // File: namespace
    url.searchParams.set("gsrsearch", cleanQuery);
    url.searchParams.set("gsrlimit", String(limit));
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|size|extmetadata|mime");
    url.searchParams.set("iiurlwidth", "400"); // thumbnail width
    url.searchParams.set("origin", "*");

    try {
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(6000),
        headers: {
          "User-Agent": this.userAgent,
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        console.warn(`[Wikimedia] HTTP ${res.status}: ${res.statusText}`);
        return [];
      }

      const data: WikiQueryResponse = await res.json();
      const pages = Object.values(data.query?.pages || {});

      const stripHtml = (html?: string) => (html || "").replace(/<[^>]+>/g, "").trim();

      const results: ImageResult[] = [];
      for (const page of pages) {
        const info = page.imageinfo?.[0];
        if (!info || !info.url) continue;

        // Skip non-image media (e.g. audio, ogg, pdf, svg)
        const mime = info.mime || "";
        if (!mime.startsWith("image/") || mime.includes("tiff")) {
          continue;
        }

        const ext = info.extmetadata || {};
        const title = page.title.replace(/^File:/, "").replace(/\.[^.]+$/, "");
        const creator = stripHtml(ext.Artist?.value) || "Wikimedia Contributor";
        const license = ext.LicenseShortName?.value || ext.License?.value || "Creative Commons / Public Domain";
        const licenseUrl = ext.LicenseUrl?.value;
        const attribution = stripHtml(ext.Credit?.value) || `${title} by ${creator} via Wikimedia Commons`;

        results.push({
          id: `wikimedia-${page.pageid}`,
          provider: "wikimedia",
          title,
          thumbnailUrl: info.thumburl || info.url,
          imageUrl: info.url,
          sourcePageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
          creator,
          license,
          licenseUrl,
          attribution,
          width: info.width,
          height: info.height,
          description: stripHtml(ext.ImageDescription?.value)
        });
      }

      queryCache.set(cacheKey, results);
      return results;
    } catch (err) {
      console.warn("[Wikimedia] Request failed:", err instanceof Error ? err.message : err);
      return [];
    }
  }
}
