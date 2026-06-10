import type { CanvasPatch, CanvasPatchEnvelope } from "@/types/canvas";

const CANVAS_BLOCK_RE =
  /<redstone-canvas\s*>([\s\S]*?)<\/redstone-canvas\s*>/gi;

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
      /* ignore malformed canvas blocks */
    }
  }
  return patches;
}

export function stripCanvasBlocks(text: string): string {
  return text.replace(CANVAS_BLOCK_RE, "").trim();
}
