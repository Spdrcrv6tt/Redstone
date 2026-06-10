import type { CanvasPatch, CanvasPatchEnvelope } from "@/types/canvas";

const CANVAS_BLOCK_RE =
  /<redstone-canvas\s*>([\s\S]*?)<\/redstone-canvas\s*>/gi;

const CANVAS_OPEN_RE = /<redstone-canvas\s*>/i;

function extractCompleteJsonObjects(slice: string): CanvasPatch[] {
  const results: CanvasPatch[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const chunk = slice.slice(start, i + 1);
        try {
          const obj = JSON.parse(chunk) as CanvasPatch;
          if (obj && typeof obj === "object" && "op" in obj) {
            results.push(obj);
          }
        } catch {
          /* wait for more tokens */
        }
        start = -1;
      }
    }
  }
  return results;
}

function innerCanvasPayload(text: string): string | null {
  const idx = text.search(CANVAS_OPEN_RE);
  if (idx === -1) return null;

  let inner = text.slice(idx).replace(CANVAS_OPEN_RE, "");
  const close = inner.indexOf("</redstone-canvas>");
  if (close !== -1) inner = inner.slice(0, close);
  inner = inner.trim();

  const arrStart = inner.indexOf("[");
  if (arrStart === -1) return null;

  return inner.slice(arrStart + 1);
}

/** Parse complete canvas blocks from finished text. */
export function parseCanvasPatchesFromText(text: string): CanvasPatch[] {
  const patches: CanvasPatch[] = [];
  for (const match of text.matchAll(CANVAS_BLOCK_RE)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as CanvasPatch[] | CanvasPatchEnvelope;
      if (Array.isArray(parsed)) {
        patches.push(...parsed);
      } else if (parsed && Array.isArray(parsed.patches)) {
        patches.push(...parsed.patches);
      }
    } catch {
      const body = raw.startsWith("[") ? raw.slice(1) : raw;
      patches.push(...extractCompleteJsonObjects(body));
    }
  }
  return patches;
}

/** Incremental parse while the model is still streaming JSON inside <redstone-canvas>. */
export function parseStreamingCanvasPatches(text: string): CanvasPatch[] {
  const body = innerCanvasPayload(text);
  if (!body) return [];
  return extractCompleteJsonObjects(body);
}

export function stripCanvasBlocks(text: string): string {
  return text.replace(CANVAS_BLOCK_RE, "").trim();
}
