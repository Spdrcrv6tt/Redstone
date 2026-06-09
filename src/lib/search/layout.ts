import type { SearchImage } from "@/types";

export type ImageLayout = "float-right" | "float-left" | "full" | "journal";

const LAYOUT_RE =
  /^<image-layout>(float-right|float-left|full|journal)<\/image-layout>\s*\n?/i;

export function parseImageLayout(content: string): {
  layout: ImageLayout | null;
  content: string;
} {
  const match = content.match(LAYOUT_RE);
  if (!match) return { layout: null, content };
  return {
    layout: match[1].toLowerCase() as ImageLayout,
    content: content.slice(match[0].length),
  };
}

export function stripImageLayoutTag(content: string): string {
  return content.replace(LAYOUT_RE, "");
}

/** Pick a layout when the model does not specify one. */
export function inferImageLayout(images: SearchImage[]): ImageLayout {
  const img = images[0];
  if (img?.width && img?.height) {
    const ratio = img.width / img.height;
    if (ratio > 1.55) return "full";
  }

  return "float-right";
}

const IMG_HERE_RE = /<img-here\s*\/?>/i;

/** Model places this before the paragraph the image should accompany. */
export function splitAtImageMarker(content: string): {
  before: string;
  after: string;
} | null {
  const match = content.match(IMG_HERE_RE);
  if (!match || match.index === undefined) return null;

  return {
    before: content.slice(0, match.index).replace(IMG_HERE_RE, "").trim(),
    after: content.slice(match.index + match[0].length).trim(),
  };
}

export function stripImageMarkers(content: string): string {
  return content.replace(/<img-here\s*\/?>/gi, "").trim();
}

/** Opening paragraph for float layouts — body text wraps beside the figure. */
export function splitLeadParagraph(content: string): {
  lead: string;
  body: string;
} | null {
  const idx = content.indexOf("\n\n");
  if (idx === -1) return null;
  return {
    lead: content.slice(0, idx),
    body: content.slice(idx + 2),
  };
}
