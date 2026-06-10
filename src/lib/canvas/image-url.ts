import { proxiedImagePath, remoteUrlFromProxy } from "@/lib/image-proxy";

/** Resolve a canvas card image URL for reliable <img> loading. */
export function resolveCanvasImageSrc(url: string | undefined): string {
  if (!url?.trim()) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("/api/image-proxy")) {
    return trimmed;
  }
  if (remoteUrlFromProxy(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return proxiedImagePath(trimmed);
  }
  return trimmed;
}
