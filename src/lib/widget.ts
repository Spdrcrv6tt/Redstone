import { parseImageGenerationSpec } from "@/lib/image-gen";
import { parseFlashcardDeck, parseStudyQuiz } from "@/lib/study";
import type { ImageGenerationSpec } from "@/types/image-gen";
import type { FlashcardDeckSpec, StudyQuizSpec } from "@/types/study";
import type { WidgetArchitectSpec } from "@/types/widget";

export type ContentSegment =
  | { type: "markdown"; text: string }
  | { type: "widget"; spec: WidgetArchitectSpec }
  | { type: "widget-pending" }
  | { type: "image"; spec: ImageGenerationSpec }
  | { type: "image-pending" }
  | { type: "flashcards"; spec: FlashcardDeckSpec }
  | { type: "flashcards-pending" }
  | { type: "quiz"; spec: StudyQuizSpec }
  | { type: "quiz-pending" };

const ASSISTANT_BLOCK_RE =
  /<(redstone-widget|redstone-image|redstone-flashcards|redstone-quiz)\s*>([\s\S]*?)<\/\1\s*>/gi;

const OPEN_TAG_DEFS = [
  {
    tag: "redstone-widget",
    open: /<redstone-widget\s*>/i,
    close: /<\/redstone-widget\s*>/i,
  },
  {
    tag: "redstone-image",
    open: /<redstone-image\s*>/i,
    close: /<\/redstone-image\s*>/i,
  },
  {
    tag: "redstone-flashcards",
    open: /<redstone-flashcards\s*>/i,
    close: /<\/redstone-flashcards\s*>/i,
  },
  {
    tag: "redstone-quiz",
    open: /<redstone-quiz\s*>/i,
    close: /<\/redstone-quiz\s*>/i,
  },
] as const;

const WIDGET_OPEN_RE = /<redstone-widget\s*>/i;
const WIDGET_CLOSE_RE = /<\/redstone-widget\s*>/i;
const WIDGET_BLOCK_RE =
  /<redstone-widget\s*>([\s\S]*?)<\/redstone-widget\s*>/gi;

const PLACEHOLDER_PREFIX = "\u0000REDSTONE_WIDGET_";
const PLACEHOLDER_SUFFIX = "\u0000";

/** Shield widget payloads from prose cleaners. */
export function protectWidgetBlocks(text: string): {
  text: string;
  restore: (cleaned: string) => string;
} {
  const blocks: string[] = [];
  const shielded = text.replace(
    /<redstone-widget\s*>[\s\S]*?(?:<\/redstone-widget\s*>|$)/gi,
    (match) => {
      const id = blocks.length;
      blocks.push(match);
      return `${PLACEHOLDER_PREFIX}${id}${PLACEHOLDER_SUFFIX}`;
    }
  );

  return {
    text: shielded,
    restore: (cleaned: string) =>
      cleaned.replace(
        /\u0000REDSTONE_WIDGET_(\d+)\u0000/g,
        (_, index) => blocks[Number(index)] ?? ""
      ),
  };
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function repairTruncatedJson(text: string): unknown | null {
  let attempt = text.trim();
  attempt = attempt.replace(/,\s*([}\]])/g, "$1");
  attempt = attempt.replace(/,\s*$/, "");
  attempt = attempt.replace(/"[^"]*$/, '"');
  attempt = attempt.replace(/:\s*$/, ": null");

  const openBraces = (attempt.match(/{/g) || []).length;
  const closeBraces = (attempt.match(/}/g) || []).length;
  const openBrackets = (attempt.match(/\[/g) || []).length;
  const closeBrackets = (attempt.match(/]/g) || []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) attempt += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) attempt += "}";

  try {
    return JSON.parse(attempt);
  } catch {
    return null;
  }
}

/** Parse architect JSON into a DynamicWidget spec. */
export function parseWidgetArchitectSpec(raw: string): WidgetArchitectSpec | null {
  const trimmed = stripJsonFences(raw.trim());
  if (!trimmed.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    parsed = repairTruncatedJson(trimmed);
    if (!parsed) return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;

  const component = record.component;
  if (component !== "DynamicWidget") return null;

  const props = record.props;
  if (!props || typeof props !== "object") return null;
  const propsRecord = props as Record<string, unknown>;

  const spec =
    (typeof propsRecord.spec === "string" && propsRecord.spec.trim()) ||
    (typeof record.spec === "string" && record.spec.trim()) ||
    "";

  if (!spec) return null;

  const height =
    typeof propsRecord.height === "string" ? propsRecord.height : "65vh";

  const html =
    typeof propsRecord.html === "string" && propsRecord.html.trim()
      ? propsRecord.html
      : undefined;

  return {
    component: "DynamicWidget",
    props: { spec, height, ...(html ? { html } : {}) },
  };
}

/** Persist builder HTML into the nth <redstone-widget> block in message content. */
export function embedWidgetHtml(
  content: string,
  widgetIndex: number,
  html: string
): string {
  let index = 0;
  return content.replace(WIDGET_BLOCK_RE, (match, payload: string) => {
    if (index !== widgetIndex) {
      index++;
      return match;
    }
    index++;

    const spec = parseWidgetArchitectSpec(payload);
    if (!spec || spec.props.html) return match;

    const enriched = {
      component: "DynamicWidget",
      props: { ...spec.props, html },
    };
    return `<redstone-widget>${JSON.stringify(enriched)}</redstone-widget>`;
  });
}

function pushBlockSegment(
  segments: ContentSegment[],
  tag: string,
  payload: string
) {
  switch (tag.toLowerCase()) {
    case "redstone-image": {
      const spec = parseImageGenerationSpec(payload);
      segments.push(spec ? { type: "image", spec } : { type: "image-pending" });
      return;
    }
    case "redstone-flashcards": {
      const spec = parseFlashcardDeck(payload);
      segments.push(
        spec ? { type: "flashcards", spec } : { type: "flashcards-pending" }
      );
      return;
    }
    case "redstone-quiz": {
      const spec = parseStudyQuiz(payload);
      segments.push(spec ? { type: "quiz", spec } : { type: "quiz-pending" });
      return;
    }
    default: {
      const spec = parseWidgetArchitectSpec(payload);
      segments.push(spec ? { type: "widget", spec } : { type: "widget-pending" });
    }
  }
}

function parseOpenPayload(tag: string, payload: string): ContentSegment | null {
  switch (tag) {
    case "redstone-image": {
      const spec = parseImageGenerationSpec(payload);
      return spec ? { type: "image", spec } : null;
    }
    case "redstone-flashcards": {
      const spec = parseFlashcardDeck(payload);
      return spec ? { type: "flashcards", spec } : null;
    }
    case "redstone-quiz": {
      const spec = parseStudyQuiz(payload);
      return spec ? { type: "quiz", spec } : null;
    }
    default: {
      const spec = parseWidgetArchitectSpec(payload);
      return spec ? { type: "widget", spec } : null;
    }
  }
}

function pendingSegmentForTag(tag: string): ContentSegment {
  switch (tag) {
    case "redstone-image":
      return { type: "image-pending" };
    case "redstone-flashcards":
      return { type: "flashcards-pending" };
    case "redstone-quiz":
      return { type: "quiz-pending" };
    default:
      return { type: "widget-pending" };
  }
}

function extractClosedBlocks(content: string): {
  segments: ContentSegment[];
  remainder: string;
} {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(ASSISTANT_BLOCK_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const text = content.slice(lastIndex, index).trim();
      if (text) segments.push({ type: "markdown", text });
    }

    pushBlockSegment(segments, match[1] ?? "", match[2] ?? "");
    lastIndex = index + match[0].length;
  }

  return { segments, remainder: content.slice(lastIndex) };
}

function finalizeOpenBlock(
  remainder: string,
  streamComplete: boolean
): ContentSegment[] {
  let earliest: {
    tag: string;
    openMatch: RegExpMatchArray;
    close: RegExp;
  } | null = null;

  for (const def of OPEN_TAG_DEFS) {
    const openMatch = remainder.match(def.open);
    if (!openMatch || openMatch.index === undefined) continue;
    if (!earliest || openMatch.index < (earliest.openMatch.index ?? 0)) {
      earliest = { tag: def.tag, openMatch, close: def.close };
    }
  }

  if (!earliest || earliest.openMatch.index === undefined) {
    const tail = remainder.trim();
    return tail ? [{ type: "markdown", text: tail }] : [];
  }

  const { tag, openMatch, close } = earliest;
  const openIndex = openMatch.index ?? 0;
  const before = remainder.slice(0, openIndex).trim();
  const afterOpen = remainder.slice(openIndex + openMatch[0].length).trim();

  const segments: ContentSegment[] = [];
  if (before) segments.push({ type: "markdown", text: before });

  const closeMatch = afterOpen.match(close);
  const payload = closeMatch
    ? afterOpen.slice(0, closeMatch.index).trim()
    : afterOpen;

  const parsed = parseOpenPayload(tag, payload);
  if (parsed) {
    segments.push(parsed);
    if (closeMatch && closeMatch.index !== undefined) {
      const tail = afterOpen
        .slice(closeMatch.index + closeMatch[0].length)
        .trim();
      if (tail) segments.push({ type: "markdown", text: tail });
    }
    return segments;
  }

  if (!streamComplete) {
    segments.push(pendingSegmentForTag(tag));
    return segments;
  }

  return segments;
}

/** Split assistant content into markdown, widget, and image segments. */
export function parseContentSegments(
  content: string,
  options: { streamComplete?: boolean } = {}
): ContentSegment[] {
  const { segments, remainder } = extractClosedBlocks(content);
  const tailSegments = finalizeOpenBlock(
    remainder,
    options.streamComplete === true
  );

  const merged = [...segments, ...tailSegments];
  return merged.length ? merged : [{ type: "markdown", text: content }];
}

export function stripWidgetBlocks(text: string): string {
  return text
    .replace(WIDGET_BLOCK_RE, "\n[interactive widget]\n")
    .replace(/<redstone-widget\s*>[\s\S]*$/i, "")
    .trim();
}

/** Strip markdown code fences from builder HTML output. */
export function stripBuilderHtmlFences(html: string): string {
  const trimmed = html.trim();
  const fenced = trimmed.match(/^```(?:html)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fenced) return fenced[1].trim();

  const doctypeIdx = trimmed.search(/<!DOCTYPE/i);
  if (doctypeIdx > 0) return trimmed.slice(doctypeIdx).trim();

  const htmlIdx = trimmed.search(/<html[\s>]/i);
  if (htmlIdx > 0) return trimmed.slice(htmlIdx).trim();

  return trimmed;
}
