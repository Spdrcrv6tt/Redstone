export interface ParsedCodeBlock {
  lang: string;
  content: string;
}

const FENCED_RE = /```(\w*)\s*\n([\s\S]*?)```/g;

const WEB_LANGS = new Set(["html", "htm", "css", "javascript", "js"]);

export function parseFencedCodeBlocks(markdown: string): ParsedCodeBlock[] {
  const blocks: ParsedCodeBlock[] = [];
  let match: RegExpExecArray | null;
  while ((match = FENCED_RE.exec(markdown)) !== null) {
    blocks.push({
      lang: (match[1] || "text").toLowerCase(),
      content: match[2].replace(/\n$/, ""),
    });
  }
  return blocks;
}

export function hasWebPreview(markdown: string): boolean {
  return parseFencedCodeBlocks(markdown).some((b) => WEB_LANGS.has(b.lang));
}

function isFullHtmlDocument(content: string): boolean {
  const lower = content.trim().toLowerCase();
  return lower.startsWith("<!doctype") || lower.includes("<html");
}

function injectBeforeClose(
  doc: string,
  closeTag: string,
  injection: string
): string {
  const idx = doc.toLowerCase().lastIndexOf(closeTag);
  if (idx === -1) return doc + injection;
  return doc.slice(0, idx) + injection + "\n" + doc.slice(idx);
}

/** Combine HTML / CSS / JS blocks from a message into one sandboxed document. */
export function buildWebPreviewDocument(markdown: string): string {
  const blocks = parseFencedCodeBlocks(markdown);
  const htmlBlocks = blocks.filter((b) => b.lang === "html" || b.lang === "htm");
  const cssBlocks = blocks.filter((b) => b.lang === "css");
  const jsBlocks = blocks.filter((b) => b.lang === "javascript" || b.lang === "js");

  const css = cssBlocks.map((b) => b.content).join("\n");
  const js = jsBlocks.map((b) => b.content).join("\n");

  const fullHtml = htmlBlocks.find((b) => isFullHtmlDocument(b.content));
  if (fullHtml) {
    let doc = fullHtml.content;
    if (css && !/<style[\s>]/i.test(doc)) {
      const styleTag = `<style>\n${css}\n</style>`;
      if (/<\/head>/i.test(doc)) {
        doc = injectBeforeClose(doc, "</head>", styleTag);
      } else {
        doc = `${styleTag}\n${doc}`;
      }
    }
    if (js && !/<script[\s>]/i.test(doc)) {
      const scriptTag = `<script>\n${js}\n<\/script>`;
      if (/<\/body>/i.test(doc)) {
        doc = injectBeforeClose(doc, "</body>", scriptTag);
      } else {
        doc = `${doc}\n${scriptTag}`;
      }
    }
    return doc;
  }

  const html =
    htmlBlocks.map((b) => b.content).join("\n") ||
    (css || js ? "<!-- Add an HTML block to render markup -->" : "<p></p>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
${css}
</style>
</head>
<body>
${html}
<script>
${js}
<\/script>
</body>
</html>`;
}

export function isWebLang(lang: string | null | undefined): boolean {
  if (!lang) return false;
  return WEB_LANGS.has(lang.toLowerCase());
}
