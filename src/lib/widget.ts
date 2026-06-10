import type { WidgetArchitectSpec } from "@/types/widget";

export type ContentSegment =
  | { type: "markdown"; text: string }
  | { type: "widget"; spec: WidgetArchitectSpec }
  | { type: "widget-pending" };

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

function extractClosedWidgets(content: string): {
  segments: ContentSegment[];
  remainder: string;
} {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(WIDGET_BLOCK_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const text = content.slice(lastIndex, index).trim();
      if (text) segments.push({ type: "markdown", text });
    }

    const spec = parseWidgetArchitectSpec(match[1] ?? "");
    if (spec) {
      segments.push({ type: "widget", spec });
    } else {
      segments.push({ type: "widget-pending" });
    }

    lastIndex = index + match[0].length;
  }

  return { segments, remainder: content.slice(lastIndex) };
}

function finalizeOpenWidget(
  remainder: string,
  streamComplete: boolean
): ContentSegment[] {
  const openMatch = remainder.match(WIDGET_OPEN_RE);
  if (!openMatch || openMatch.index === undefined) {
    const tail = remainder.trim();
    return tail ? [{ type: "markdown", text: tail }] : [];
  }

  const before = remainder.slice(0, openMatch.index).trim();
  const afterOpen = remainder
    .slice(openMatch.index + openMatch[0].length)
    .trim();

  const segments: ContentSegment[] = [];
  if (before) segments.push({ type: "markdown", text: before });

  const closeMatch = afterOpen.match(WIDGET_CLOSE_RE);
  const payload = closeMatch
    ? afterOpen.slice(0, closeMatch.index).trim()
    : afterOpen;

  const spec = parseWidgetArchitectSpec(payload);
  if (spec) {
    segments.push({ type: "widget", spec });
    if (closeMatch && closeMatch.index !== undefined) {
      const tail = afterOpen
        .slice(closeMatch.index + closeMatch[0].length)
        .trim();
      if (tail) segments.push({ type: "markdown", text: tail });
    }
    return segments;
  }

  if (payload.length > 0 && (streamComplete || payload.length > 40)) {
    if (streamComplete) {
      const repaired = parseWidgetArchitectSpec(payload);
      if (repaired) {
        segments.push({ type: "widget", spec: repaired });
        return segments;
      }
    }
  }

  if (streamComplete) {
    return segments;
  }

  segments.push({ type: "widget-pending" });
  return segments;
}

/** Split assistant content into markdown and widget segments. */
export function parseContentSegments(
  content: string,
  options: { streamComplete?: boolean } = {}
): ContentSegment[] {
  const { segments, remainder } = extractClosedWidgets(content);
  const tailSegments = finalizeOpenWidget(
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
