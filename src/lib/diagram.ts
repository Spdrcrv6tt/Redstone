export type DiagramSegment =
  | { type: "markdown"; text: string }
  | { type: "diagram"; html: string }
  | { type: "diagram-pending" };

const DIAGRAM_BLOCK_RE =
  /<redstone-diagram>([\s\S]*?)<\/redstone-diagram>/gi;

const OPEN_DIAGRAM_RE = /<redstone-diagram>/i;

/** Split assistant content into markdown and diagram segments. */
export function parseDiagramSegments(content: string): DiagramSegment[] {
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

  const remainder = content.slice(lastIndex);
  const openIdx = remainder.search(OPEN_DIAGRAM_RE);

  if (openIdx !== -1) {
    const before = remainder.slice(0, openIdx).trim();
    if (before) segments.push({ type: "markdown", text: before });
    segments.push({ type: "diagram-pending" });
    return segments;
  }

  const tail = remainder.trim();
  if (tail) segments.push({ type: "markdown", text: tail });

  return segments.length ? segments : [{ type: "markdown", text: content }];
}

/** Remove diagram blocks for plain-text copy. */
export function stripDiagramBlocks(text: string): string {
  return text
    .replace(DIAGRAM_BLOCK_RE, "\n[interactive diagram]\n")
    .replace(/<redstone-diagram>[\s\S]*$/i, "")
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
