/** Client-safe relative path; always resolves against the current site origin. */
export function proxiedImagePath(remoteUrl: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(remoteUrl)}`;
}

export function remoteUrlFromProxy(proxyUrlOrPath: string): string | null {
  try {
    const url = proxyUrlOrPath.startsWith("/")
      ? new URL(proxyUrlOrPath, "http://local")
      : new URL(proxyUrlOrPath);
    const raw = url.searchParams.get("url");
    return raw ? decodeURIComponent(raw) : null;
  } catch {
    return null;
  }
}

export function isAllowedRemoteImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.endsWith(".local")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const FETCH_HEADERS = (remoteUrl: string) => {
  let referer = "";
  try {
    referer = new URL(remoteUrl).origin + "/";
  } catch {
    /* ignore */
  }
  return {
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "User-Agent":
      "Mozilla/5.0 (compatible; Redstone/1.0; +https://github.com/Spdrcrv6tt/Redstone)",
    ...(referer ? { Referer: referer } : {}),
  };
};

function candidateUrls(raw: string): string[] {
  if (raw.startsWith("http://")) {
    const https = raw.replace(/^http:\/\//i, "https://");
    return https === raw ? [raw] : [https, raw];
  }
  return [raw];
}

/** Fetch a remote image for server-side proxying or validation. */
export async function fetchRemoteImage(
  raw: string,
  timeoutMs = 12_000
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  if (!isAllowedRemoteImageUrl(raw)) return null;

  for (const url of candidateUrls(raw)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetch(url, {
        signal: controller.signal,
        headers: FETCH_HEADERS(url),
        cache: "no-store",
      });
      if (!upstream.ok) continue;

      const type = upstream.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) continue;

      const buffer = await upstream.arrayBuffer();
      if (buffer.byteLength < 512) continue;

      return { buffer, contentType: type };
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

/** True when the remote URL returns a real image body. */
export async function verifyRemoteImageUrl(raw: string): Promise<boolean> {
  const result = await fetchRemoteImage(raw, 8_000);
  return result !== null;
}
