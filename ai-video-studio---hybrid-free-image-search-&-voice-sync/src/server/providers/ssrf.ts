/**
 * Safe Remote Fetch with SSRF Protection
 * Blocks private IP ranges, loopback, link-local, cloud metadata services, and invalid protocols.
 */

import dns from "node:dns/promises";
import net from "node:net";

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local & AWS/GCP metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 224.0.0.0/4 (multicast)
    if (parts[0] >= 224) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // ::1 (loopback)
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
    // fe80::/10 (link-local)
    if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    // fc00::/7 (unique local)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // IPv4-mapped IPv6 (::ffff:127.0.0.1)
    if (lower.includes("::ffff:")) {
      const v4Part = lower.split("::ffff:")[1];
      if (v4Part && net.isIPv4(v4Part)) {
        return isPrivateIp(v4Part);
      }
    }
    return false;
  }

  return true;
}

export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL không hợp lệ");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Giao thức không được phép: ${parsed.protocol}. Chỉ chấp nhận http hoặc https.`);
  }

  const hostname = parsed.hostname;
  if (!hostname || hostname === "localhost") {
    throw new Error("Truy cập localhost bị chặn để bảo vệ an toàn hệ thống");
  }

  // Resolve hostname to IP
  try {
    const lookup = await dns.lookup(hostname);
    if (isPrivateIp(lookup.address)) {
      throw new Error(`Địa chỉ IP đích (${lookup.address}) nằm trong dải mạng nội bộ riêng tư, đã bị chặn (SSRF Protection).`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("SSRF Protection")) {
      throw err;
    }
    throw new Error(`Không thể phân giải tên miền: ${hostname}`);
  }

  return parsed;
}

export async function safeFetchImage(
  url: string,
  maxSizeBytes = 15 * 1024 * 1024,
  timeoutMs = 12000
): Promise<{ buffer: Buffer; contentType: string }> {
  const safeUrl = await validateSafeUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(safeUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} khi tải ảnh từ nguồn`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (
      !contentType.startsWith("image/") &&
      !contentType.includes("octet-stream")
    ) {
      throw new Error(`Định dạng tệp không phải ảnh: ${contentType}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > maxSizeBytes) {
      throw new Error(`Dung lượng ảnh vượt quá giới hạn cho phép (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB > ${(maxSizeBytes / 1024 / 1024).toFixed(1)} MB)`);
    }

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: contentType.startsWith("image/") ? contentType : "image/jpeg"
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
