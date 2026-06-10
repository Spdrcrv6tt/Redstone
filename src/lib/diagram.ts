export type DiagramSegment =
  | { type: "markdown"; text: string }
  | { type: "diagram"; payload: string }
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

/** Unwrap a markdown fence when the model ignores the no-fence rule. */
export function unwrapDiagramFences(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:json|html)?\s*\n([\s\S]*?)\n```\s*$/i);
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
    segments.push({ type: "diagram", payload: (match[1] ?? "").trim() });
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
    const payload = afterOpen.slice(0, closeMatch.index).trim();
    if (payload) segments.push({ type: "diagram", payload });
    const tail = afterOpen
      .slice(closeMatch.index + closeMatch[0].length)
      .trim();
    if (tail) segments.push({ type: "markdown", text: tail });
    return segments;
  }

  const minPartial = afterOpen.trimStart().startsWith("{") ? 24 : 120;
  if (afterOpen.length > 0 && (streamComplete || afterOpen.length > minPartial)) {
    segments.push({ type: "diagram", payload: afterOpen });
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

const WIDGET_VIEWPORT_CSS = `html,body{height:100%;margin:0;padding:0;overflow:hidden;background:#0f1117;color:#e2e8f0;box-sizing:border-box;}
body{display:flex;flex-direction:column;min-height:100vh;max-height:100vh;}
.canvas,[data-widget-canvas],main.visualization,#canvas{flex:1 1 auto;flex-grow:1;min-height:50vh;min-height:0;width:100%;overflow:hidden;}
.controls,[data-widget-controls],.toolbar,.readout,.legend{flex:0 0 auto;padding:0.5rem 0.75rem;font-size:0.8125rem;line-height:1.3;}
*,*::before,*::after{box-sizing:inherit;}`;

/** Wrap fragment HTML in a minimal document and report height to the parent frame. */
export function normalizeDiagramHtml(
  html: string,
  options?: { widgetViewport?: boolean }
): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return "<!DOCTYPE html><html><body></body></html>";
  }

  const widgetViewport = options?.widgetViewport === true;
  const resizeScript = `<script>
(function () {
  function report() {
    var viewport = window.innerHeight || document.documentElement.clientHeight || 0;
    var content = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );
    var h = ${widgetViewport ? "viewport || content" : "content"};
    parent.postMessage({ type: "redstone-diagram-height", height: h }, "*");
  }
  window.addEventListener("load", report);
  window.addEventListener("resize", report);
  if (document.readyState === "complete") report();
})();
</script>`;

  const viewportStyle = widgetViewport
    ? `<style id="redstone-widget-layout">${WIDGET_VIEWPORT_CSS}</style>`
    : "";

  if (/<!DOCTYPE|<html/i.test(trimmed)) {
    let doc = trimmed;
    if (widgetViewport && viewportStyle) {
      if (/<head[^>]*>/i.test(doc)) {
        doc = doc.replace(/<head[^>]*>/i, (m) => `${m}\n${viewportStyle}`);
      } else {
        doc = doc.replace(/<html[^>]*>/i, (m) => `${m}<head>${viewportStyle}</head>`);
      }
    }
    if (/<\/body>/i.test(doc)) {
      return doc.replace(/<\/body>/i, `${resizeScript}</body>`);
    }
    return `${doc}${resizeScript}`;
  }

  const baseStyle = widgetViewport
    ? WIDGET_VIEWPORT_CSS
    : "html,body{margin:0;padding:0;}";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${baseStyle}</style>
</head>
<body>
${trimmed}
${resizeScript}
</body>
</html>`;
}
