import { needsUnconditionalDeepEnrich } from "@/lib/search/query-enhance";
import type { SearchSource } from "@/types";

/** Rough token estimate (~4 chars/token for English prose). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

const SKIP_SECTION_HEADINGS = [
  /^background$/i,
  /^in popular culture/i,
  /^popular culture/i,
  /^cultural impact/i,
  /^training and preparation/i,
  /^mission insignia/i,
  /^call signs/i,
  /^space vehicle/i,
  /^astronauts and/i,
  /^mission parameters/i,
  /^experiments and scientific/i,
  /^pre-?launch/i,
  /^preflight/i,
  /^see also/i,
  /^references$/i,
  /^sources$/i,
  /^external links/i,
  /^legacy$/i,
  /^dramatization/i,
  /^gallery$/i,
  /^notes$/i,
  /^public and media reaction/i,
  /^review board$/i,
  /^changes in response/i,
  /^nasa reports$/i,
  /^cast and crew/i,
  /^production/i,
  /^reception/i,
];

const EVENT_SECTION_HEADINGS = [
  /accident/i,
  /explosion/i,
  /critical event/i,
  /malfunction/i,
  /carbon dioxide/i,
  /crisis/i,
  /reentry/i,
  /splashdown/i,
  /return to earth/i,
  /looping around/i,
  /loop around/i,
  /launch and translunar/i,
  /flight of apollo/i,
  /trans-?earth/i,
];

const EVENT_BODY_HINTS =
  /\b(explosion|oxygen tank|splashdown|reentry|re-entry|lifeboat|scrubber|hours? after|mission control|abort|vented|circumlunar)\b/i;

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
    "walk",
    "through",
    "during",
    "sequence",
    "events",
    "me",
    "official",
    "mission",
    "summary",
    "site",
    "nasa",
    "gov",
    "org",
    "wikipedia",
  ]);

  return query
    .toLowerCase()
    .replace(/site:\S+/g, " ")
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
}

interface WikiSection {
  heading: string;
  body: string;
  order: number;
}

/** True when a block/line is a Wikipedia section title (not prose). */
function isWikiHeadingLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 100) return false;
  if (/[.,:;!?]/.test(t)) return false;
  if (!/^[A-Z0-9]/.test(t)) return false;
  // Prose sentences usually contain lowercase words beyond articles.
  const words = t.split(/\s+/);
  if (words.length === 1) return /^[A-Z][A-Za-z0-9-]+$/.test(t);
  const lowerWords = words.filter((w) => /^[a-z]/.test(w));
  return lowerWords.length <= 2;
}

/** Split a Wikipedia plain-text extract into labeled sections. */
export function splitWikiSections(text: string): WikiSection[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const blocks = trimmed.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length) return [{ heading: "", body: trimmed, order: 0 }];

  const sections: WikiSection[] = [];
  const leadParts: string[] = [];

  const pushSection = (heading: string, body: string) => {
    const h = heading.trim();
    const b = body.trim();
    if (!h && !b) return;
    sections.push({ heading: h, body: b, order: sections.length });
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] ?? "";

    if (isWikiHeadingLine(block)) {
      const next = blocks[i + 1];
      if (next && !isWikiHeadingLine(next)) {
        pushSection(block, next);
        i++;
      } else {
        pushSection(block, "");
      }
      continue;
    }

    const lines = block.split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    const rest = lines.slice(1).join("\n").trim();

    if (rest && isWikiHeadingLine(firstLine)) {
      pushSection(firstLine, rest);
      continue;
    }

    if (sections.length === 0) {
      leadParts.push(block);
    } else {
      const last = sections[sections.length - 1];
      last.body = last.body ? `${last.body}\n\n${block}` : block;
    }
  }

  if (leadParts.length) {
    sections.unshift({
      heading: "",
      body: leadParts.join("\n\n"),
      order: 0,
    });
    sections.forEach((s, idx) => {
      s.order = idx;
    });
  }

  return sections.length ? sections : [{ heading: "", body: trimmed, order: 0 }];
}

function shouldSkipSection(heading: string): boolean {
  const h = heading.trim();
  if (!h) return false;
  return SKIP_SECTION_HEADINGS.some((re) => re.test(h));
}

function sectionScore(
  section: WikiSection,
  keywords: string[],
  timelineQuery: boolean
): number {
  const combined = `${section.heading} ${section.body}`.toLowerCase();
  let score = keywords.filter((k) => combined.includes(k)).length;

  if (EVENT_SECTION_HEADINGS.some((re) => re.test(section.heading))) {
    score += 4;
  }
  if (EVENT_BODY_HINTS.test(combined)) {
    score += 2;
  }

  if (timelineQuery && !section.heading) {
    // Deprioritize generic lead on timeline queries when event sections exist.
    score = Math.max(0, score - 1);
  }

  if (shouldSkipSection(section.heading)) {
    return -1;
  }

  return score;
}

/**
 * From a full Wikipedia extract, drop boilerplate sections and keep
 * query-relevant chunks in original document order.
 */
export function filterWikiExtractForQuery(
  text: string,
  query: string,
  maxChars: number
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 1500) return trimmed.replace(/[^\S\n]+/g, " ");

  const timelineQuery = needsUnconditionalDeepEnrich(query);
  const keywords = queryKeywords(query);
  const sections = splitWikiSections(trimmed);

  if (sections.length <= 1) {
    return extractRelevantParagraphs(trimmed, query, 20).slice(0, maxChars);
  }

  const scored = sections.map((section) => ({
    section,
    score: sectionScore(section, keywords, timelineQuery),
  }));

  const hasEventSections = scored.some(
    (s) => s.score >= 2 && !shouldSkipSection(s.section.heading)
  );

  const kept = scored.filter(({ section, score }) => {
    if (shouldSkipSection(section.heading)) return false;
    if (timelineQuery && hasEventSections && !section.heading) return false;
    if (score > 0) return true;
    if (timelineQuery && EVENT_BODY_HINTS.test(section.body)) return true;
    return false;
  });

  const chosen =
    kept.length > 0
      ? kept
      : scored.filter((s) => !shouldSkipSection(s.section.heading)).slice(0, 3);

  const ordered = [...chosen].sort(
    (a, b) => a.section.order - b.section.order
  );

  const chunks: string[] = [];
  let used = 0;

  for (const { section } of ordered) {
    const prefix = section.heading ? `${section.heading}\n` : "";
    const block = `${prefix}${section.body}`.replace(/[^\S\n]+/g, " ").trim();
    if (!block) continue;

    const remaining = maxChars - used;
    if (remaining <= 0) break;

    if (block.length <= remaining) {
      chunks.push(block);
      used += block.length + 2;
    } else {
      const slice = block.slice(0, remaining);
      const lastPunct = Math.max(
        slice.lastIndexOf("."),
        slice.lastIndexOf("?"),
        slice.lastIndexOf("!")
      );
      chunks.push(
        lastPunct > 80 ? slice.slice(0, lastPunct + 1) : slice.trim()
      );
      break;
    }
  }

  return chunks.join("\n\n");
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

/** ~15,000 characters aggregate context budget. */
const DEFAULT_MAX_CONTEXT_TOKENS = 4000;

function extractSnippetForSource(
  source: SearchSource,
  query: string,
  maxChars: number
): string {
  const isWikiExtract =
    /wikipedia extract/i.test(source.title) ||
    (/wikipedia\.org/i.test(source.url) && source.snippet.length > 1500);

  if (isWikiExtract) {
    return filterWikiExtractForQuery(source.snippet, query, maxChars);
  }

  if (source.snippet.length > 1500) {
    const filtered = filterWikiExtractForQuery(source.snippet, query, maxChars);
    if (filtered) return filtered;
  }

  return extractRelevantParagraphs(source.snippet, query, 12);
}

/**
 * Trim each source to keyword-relevant sections/paragraphs and cap aggregate
 * injected context at maxTokens (default 4000).
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

    const maxChars = budget * 4;
    const extracted = extractSnippetForSource(source, query, maxChars);
    const snippet =
      extracted ||
      source.snippet.slice(0, Math.min(source.snippet.length, maxChars));

    const tokens = estimateTokens(snippet);
    if (tokens > budget) {
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
