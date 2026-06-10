export type DiagramSegment =
  | { type: "markdown"; text: string }
  | { type: "diagram"; html: string }
  | { type: "diagram-pending" };

const DIAGRAM_OPEN_RE = /<redstone-diagram\s*>/i;
const DIAGRAM_CLOSE_RE = /<\/redstone-diagram\s*>/i;
const DIAGRAM_BLOCK_RE =
  /<redstone-diagram\s*>([\s\S]*?)<\/redstone-diagram\s*>/gi;

const DIAGRAM_PLACEHOLDER_PREFIX = "\u0000REDSTONE_DIAGRAM_";
const DIAGRAM_PLACEHOLDER_SUFFIX = "\u0000";

/** Shield diagram payloads from prose cleaners that strip bracketed tokens. */
export function protectDiagramBlocks(text: string): {
  text: string;
  restore: (cleaned: string) => string;
} {
  const blocks: string[] = [];
  const shielded = text.replace(
    /<redstone-diagram\s*>[\s\S]*?(?:<\/redstone-diagram\s*>|$)/gi,
    (match) => {
      const id = blocks.length;
      blocks.push(match);
      return `${DIAGRAM_PLACEHOLDER_PREFIX}${id}${DIAGRAM_PLACEHOLDER_SUFFIX}`;
    }
  );

  return {
    text: shielded,
    restore: (cleaned: string) =>
      cleaned.replace(
        /\u0000REDSTONE_DIAGRAM_(\d+)\u0000/g,
        (_, index) => blocks[Number(index)] ?? ""
      ),
  };
}

/** Unwrap a markdown html fence when the model ignores the no-fence rule. */
export function unwrapDiagramFences(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:html)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (match && DIAGRAM_OPEN_RE.test(match[1])) {
    return match[1].trim();
  }
  return content;
}

function extractClosedDiagrams(content: string): {
  segments: DiagramSegment[];
  remainder: string;
} {
  const segments: DiagramSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(DIAGRAM_BLOCK_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const text = content.slice(lastIndex, index).trim();
      if (text) segments.push({ type: "markdown", text });
    }
    segments.push({ type: "diagram", html: (match[1] ?? "").trim() });
    lastIndex = index + match[0].length;
  }

  return { segments, remainder: content.slice(lastIndex) };
}

function finalizeOpenDiagram(
  remainder: string,
  streamComplete: boolean
): DiagramSegment[] {
  const openMatch = remainder.match(DIAGRAM_OPEN_RE);
  if (!openMatch || openMatch.index === undefined) {
    const tail = remainder.trim();
    return tail ? [{ type: "markdown", text: tail }] : [];
  }

  const before = remainder.slice(0, openMatch.index).trim();
  const afterOpen = remainder
    .slice(openMatch.index + openMatch[0].length)
    .trim();

  const segments: DiagramSegment[] = [];
  if (before) segments.push({ type: "markdown", text: before });

  const closeMatch = afterOpen.match(DIAGRAM_CLOSE_RE);
  if (closeMatch && closeMatch.index !== undefined) {
    const html = afterOpen.slice(0, closeMatch.index).trim();
    if (html) segments.push({ type: "diagram", html });
    const tail = afterOpen
      .slice(closeMatch.index + closeMatch[0].length)
      .trim();
    if (tail) segments.push({ type: "markdown", text: tail });
    return segments;
  }

  if (afterOpen.length > 0 && (streamComplete || afterOpen.length > 120)) {
    segments.push({ type: "diagram", html: afterOpen });
    return segments;
  }

  if (streamComplete) {
    return segments;
  }

  segments.push({ type: "diagram-pending" });
  return segments;
}

/** Split assistant content into markdown and diagram segments. */
export function parseDiagramSegments(
  content: string,
  options: { streamComplete?: boolean } = {}
): DiagramSegment[] {
  const prepared = unwrapDiagramFences(content);
  const { segments, remainder } = extractClosedDiagrams(prepared);
  const tailSegments = finalizeOpenDiagram(
    remainder,
    options.streamComplete === true
  );

  const merged = [...segments, ...tailSegments];
  return merged.length ? merged : [{ type: "markdown", text: prepared }];
}

/** Remove diagram blocks for plain-text copy. */
export function stripDiagramBlocks(text: string): string {
  return text
    .replace(DIAGRAM_BLOCK_RE, "\n[interactive diagram]\n")
    .replace(/<redstone-diagram\s*>[\s\S]*$/i, "")
    .trim();
}

/** Wrap fragment HTML in a minimal document and report height to the parent frame. */
export function normalizeDiagramHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return "<!DOCTYPE html><html><body></body></html>";
  }

  const resizeScript = `<script>
(function () {
  function report() {
    var h = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );
    parent.postMessage({ type: "redstone-diagram-height", height: h }, "*");
  }
  window.addEventListener("load", report);
  window.addEventListener("resize", report);
  if (document.readyState === "complete") report();
})();
</script>`;

  if (/<!DOCTYPE|<html/i.test(trimmed)) {
    if (/<\/body>/i.test(trimmed)) {
      return trimmed.replace(/<\/body>/i, `${resizeScript}</body>`);
    }
    return `${trimmed}${resizeScript}`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;padding:0;}</style>
</head>
<body>
${trimmed}
${resizeScript}
</body>
</html>`;
}
