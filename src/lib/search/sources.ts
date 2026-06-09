import type { SearchSource } from "@/types";

/** Human-readable publisher label for a search result (Gemini-style). */
export function sourceLabel(source: SearchSource): string {
  try {
    const host = new URL(source.url).hostname.replace(/^www\./, "");
    const site = host.split(".")[0];

    if (site.length <= 5 && !site.includes("-")) {
      return site.toUpperCase();
    }

    const titlePart = source.title.split(/\s*[|\-–—:]\s*/)[0]?.trim();
    if (titlePart && titlePart.length > 0 && titlePart.length <= 36) {
      return titlePart;
    }

    return site
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return source.title.slice(0, 24);
  }
}

/** Parse "1", "1,2", "1, 3" into 1-based source indices. */
export function parseCiteIndices(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function resolveCitedSources(
  indices: number[],
  sources: SearchSource[]
): SearchSource[] {
  const seen = new Set<string>();
  const resolved: SearchSource[] = [];

  for (const index of indices) {
    const source = sources[index - 1];
    if (!source || seen.has(source.url)) continue;
    seen.add(source.url);
    resolved.push(source);
  }

  return resolved;
}

/** Chip text: "NASA" or "NASA + 1" */
export function formatCiteChipLabel(sources: SearchSource[]): string {
  if (sources.length === 0) return "";
  const first = sourceLabel(sources[0]);
  if (sources.length === 1) return first;
  return `${first} + ${sources.length - 1}`;
}
