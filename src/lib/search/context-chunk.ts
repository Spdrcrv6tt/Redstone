import type { SearchSource } from "@/types";

/** Rough token estimate (~4 chars/token for English prose). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function queryKeywords(query: string): string[] {
  const stop = new Set([
    "what",
    "were",
    "was",
    "the",
    "and",
    "for",
    "about",
    "tell",
    "give",
    "list",
    "name",
    "names",
    "who",
    "when",
    "where",
    "how",
    "why",
    "that",
    "this",
    "with",
    "from",
    "have",
    "has",
    "had",
    "are",
    "is",
    "of",
    "in",
    "on",
    "at",
    "to",
    "a",
    "an",
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
}

/** Split text into paragraph blocks (blank-line or sentence boundaries). */
function splitParagraphs(text: string): string[] {
  const byBlank = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (byBlank.length > 1) return byBlank;

  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);
}

/**
 * Keep paragraphs that mention at least one query keyword.
 * Falls back to the opening paragraphs if nothing matches.
 */
export function extractRelevantParagraphs(
  text: string,
  query: string,
  maxParagraphs = 6
): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";

  const keywords = queryKeywords(query);
  const paragraphs = splitParagraphs(trimmed);

  if (keywords.length === 0) {
    return paragraphs.slice(0, maxParagraphs).join("\n\n");
  }

  const scored = paragraphs.map((para) => {
    const lower = para.toLowerCase();
    const hits = keywords.filter((k) => lower.includes(k)).length;
    return { para, hits };
  });

  const matched = scored
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((s) => s.para);

  const chosen =
    matched.length > 0
      ? matched.slice(0, maxParagraphs)
      : paragraphs.slice(0, Math.min(3, maxParagraphs));

  return chosen.join("\n\n");
}

const DEFAULT_MAX_CONTEXT_TOKENS = 2000;

/**
 * Trim each source to keyword-relevant paragraphs and cap aggregate
 * injected context at maxTokens (default 2000).
 */
export function chunkSourcesForContext(
  sources: SearchSource[],
  query: string,
  maxTokens = DEFAULT_MAX_CONTEXT_TOKENS
): SearchSource[] {
  let budget = maxTokens;
  const chunked: SearchSource[] = [];

  for (const source of sources.slice(0, 4)) {
    if (budget <= 0) break;

    const extracted = extractRelevantParagraphs(source.snippet, query);
    const snippet =
      extracted ||
      source.snippet.slice(0, Math.min(source.snippet.length, budget * 4));

    const tokens = estimateTokens(snippet);
    if (tokens > budget) {
      const maxChars = budget * 4;
      const trimmed = snippet.slice(0, maxChars);
      const lastPunct = Math.max(
        trimmed.lastIndexOf("."),
        trimmed.lastIndexOf("?"),
        trimmed.lastIndexOf("!")
      );
      chunked.push({
        ...source,
        snippet:
          lastPunct > 40 ? trimmed.slice(0, lastPunct + 1) : trimmed.trim(),
      });
      break;
    }

    chunked.push({ ...source, snippet });
    budget -= tokens;
  }

  return chunked;
}
