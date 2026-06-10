import type { SearchLink, SearchSource, SearchVideo } from "@/types";
import { braveWebSearch } from "@/lib/search/brave";

const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_RE);
  return match?.[1] ?? null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

function toSearchVideo(title: string, url: string): SearchVideo | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  return {
    title: title.trim() || "YouTube video",
    videoId,
    url,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export function videosFromSources(sources: SearchSource[]): SearchVideo[] {
  const seen = new Set<string>();
  const videos: SearchVideo[] = [];

  for (const source of sources) {
    const video = toSearchVideo(source.title, source.url);
    if (!video || seen.has(video.videoId)) continue;
    seen.add(video.videoId);
    videos.push(video);
    if (videos.length >= 2) break;
  }

  return videos;
}

export async function searchYouTubeVideos(
  query: string,
  apiKey: string,
  max = 2
): Promise<SearchVideo[]> {
  const q = query.trim();
  if (!q) return [];

  const results = await braveWebSearch(`${q} site:youtube.com`, apiKey, 10);
  const seen = new Set<string>();
  const videos: SearchVideo[] = [];

  for (const result of results) {
    if (!result.url) continue;
    const video = toSearchVideo(result.title ?? "", result.url);
    if (!video || seen.has(video.videoId)) continue;
    seen.add(video.videoId);
    videos.push(video);
    if (videos.length >= max) break;
  }

  return videos;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const SKIP_LINK_DOMAINS = new Set([
  "youtube.com",
  "youtu.be",
  "m.youtube.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "tiktok.com",
]);

export function pickEmbedLinks(
  sources: SearchSource[],
  options: { max?: number; excludeUrls?: string[] } = {}
): SearchLink[] {
  const max = options.max ?? 3;
  const excluded = new Set(
    (options.excludeUrls ?? []).map((u) => u.toLowerCase())
  );
  const seenDomains = new Set<string>();
  const links: SearchLink[] = [];

  for (const source of sources) {
    const url = source.url?.trim();
    if (!url || excluded.has(url.toLowerCase())) continue;
    if (isYouTubeUrl(url)) continue;

    const domain = domainFromUrl(url);
    if (SKIP_LINK_DOMAINS.has(domain) || seenDomains.has(domain)) continue;

    seenDomains.add(domain);
    links.push({
      title: source.title?.trim() || domain,
      url,
      snippet: source.snippet?.trim().slice(0, 220) ?? "",
      domain,
    });

    if (links.length >= max) break;
  }

  return links;
}
