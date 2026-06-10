import type {
  CanvasDocument,
  CanvasNode,
  CanvasPatch,
  CanvasBounds,
} from "@/types/canvas";

export const CARD_WIDTH = 280;
export const CARD_MIN_HEIGHT = 120;
export const CARD_MAX_HEIGHT = 520;
export const LAYOUT_GAP = 48;
export const COLUMN_STRIDE = CARD_WIDTH + LAYOUT_GAP;
export const ROW_STRIDE = 200 + LAYOUT_GAP;

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function textLength(patch: {
  title?: string;
  body?: string;
  markdown?: string;
}): number {
  return (
    (patch.title?.length ?? 0) +
    (patch.body?.length ?? 0) +
    (patch.markdown?.length ?? 0)
  );
}

/** Rough card footprint for overlap checks — matches canvas-card CSS. */
export function estimateNodeSize(node: {
  data: CanvasNode["data"];
}): { width: number; height: number } {
  const chars =
    (node.data.title?.length ?? 0) +
    (node.data.body?.length ?? 0) +
    (node.data.markdown?.length ?? 0);

  let height = CARD_MIN_HEIGHT;
  if (node.data.kind === "image") height = 240;
  else if (node.data.markdown) height = CARD_MIN_HEIGHT + Math.min(chars / 2.5, 360);
  else height = CARD_MIN_HEIGHT + Math.min(chars / 3, 200);

  return {
    width: CARD_WIDTH,
    height: Math.min(Math.max(height, CARD_MIN_HEIGHT), CARD_MAX_HEIGHT),
  };
}

export function estimatePatchSize(patch: {
  kind?: string;
  title?: string;
  body?: string;
  markdown?: string;
}): { width: number; height: number } {
  if (patch.kind === "image") {
    return { width: CARD_WIDTH, height: 240 };
  }
  const chars = textLength(patch);
  const height = CARD_MIN_HEIGHT + Math.min(chars / 2.5, 360);
  return {
    width: CARD_WIDTH,
    height: Math.min(Math.max(height, CARD_MIN_HEIGHT), CARD_MAX_HEIGHT),
  };
}

function nodeToRect(node: CanvasNode): LayoutRect {
  const size = estimateNodeSize(node);
  return { x: node.position.x, y: node.position.y, ...size };
}

function inflate(rect: LayoutRect, gap: number): LayoutRect {
  return {
    x: rect.x - gap,
    y: rect.y - gap,
    width: rect.width + gap * 2,
    height: rect.height + gap * 2,
  };
}

function overlaps(a: LayoutRect, b: LayoutRect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function collides(
  pos: { x: number; y: number },
  size: { width: number; height: number },
  occupied: LayoutRect[]
): boolean {
  const rect: LayoutRect = { x: pos.x, y: pos.y, ...size };
  const padded = occupied.map((r) => inflate(r, LAYOUT_GAP / 2));
  return padded.some((o) => overlaps(rect, o));
}

/** Find the nearest non-overlapping position to the model's intent. */
export function resolvePosition(
  desired: { x: number; y: number },
  size: { width: number; height: number },
  occupied: LayoutRect[]
): { x: number; y: number } {
  if (!collides(desired, size, occupied)) return desired;

  const stepX = COLUMN_STRIDE;
  const stepY = ROW_STRIDE;

  for (let ring = 0; ring <= 10; ring++) {
    for (let row = 0; row <= ring; row++) {
      for (let col = 0; col <= ring; col++) {
        const candidates = [
          { x: desired.x + col * stepX, y: desired.y + row * stepY },
          { x: desired.x - col * stepX, y: desired.y + row * stepY },
          { x: desired.x + col * stepX, y: desired.y - row * stepY },
          { x: desired.x - col * stepX, y: desired.y - row * stepY },
        ];
        for (const pos of candidates) {
          if (!collides(pos, size, occupied)) return pos;
        }
      }
    }
  }

  const lowest = occupied.reduce(
    (max, r) => Math.max(max, r.y + r.height),
    desired.y
  );
  return { x: desired.x, y: lowest + LAYOUT_GAP };
}

interface OccupiedSlot extends LayoutRect {
  id?: string;
}

export function occupiedRects(doc: CanvasDocument): LayoutRect[] {
  return [...doc.nodes, ...doc.draftNodes].map(nodeToRect);
}

function occupiedSlots(doc: CanvasDocument): OccupiedSlot[] {
  return [...doc.nodes, ...doc.draftNodes].map((n) => ({
    ...nodeToRect(n),
    id: n.id,
  }));
}

/** Suggest an open slot inside the viewport for the next card. */
export function suggestNextPosition(
  bounds: CanvasBounds,
  occupied: LayoutRect[]
): { x: number; y: number } {
  const pad = LAYOUT_GAP;
  const size = { width: CARD_WIDTH, height: CARD_MIN_HEIGHT + 80 };
  const startX = bounds.x + pad;
  const startY = bounds.y + pad;
  const cols = Math.max(
    1,
    Math.floor((bounds.width - pad * 2) / COLUMN_STRIDE)
  );

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < cols; col++) {
      const pos = {
        x: startX + col * COLUMN_STRIDE,
        y: startY + row * ROW_STRIDE,
      };
      if (!collides(pos, size, occupied)) return pos;
    }
  }

  return resolvePosition({ x: startX, y: startY }, size, occupied);
}

type PositionedPatch =
  | Extract<CanvasPatch, { op: "create_node" }>
  | Extract<CanvasPatch, { op: "place_image" }>
  | (Extract<CanvasPatch, { op: "update_node" }> & {
      position: { x: number; y: number };
    });

function asPositionedPatch(patch: CanvasPatch): PositionedPatch | null {
  if (patch.op === "create_node" || patch.op === "place_image") return patch;
  if (patch.op === "update_node" && patch.position) {
    return { ...patch, position: patch.position };
  }
  return null;
}

/** Nudge create/place/update positions so cards never stack on top of each other. */
export function resolvePatchLayout(
  doc: CanvasDocument,
  patches: CanvasPatch[]
): CanvasPatch[] {
  const slots: OccupiedSlot[] = occupiedSlots(doc);
  const resolved: CanvasPatch[] = [];

  for (const patch of patches) {
    const positioned = asPositionedPatch(patch);
    if (!positioned) {
      resolved.push(patch);
      continue;
    }

    const size =
      positioned.op === "create_node"
        ? estimatePatchSize(positioned)
        : positioned.op === "place_image"
          ? estimatePatchSize({ kind: "image", title: positioned.title })
          : (() => {
              const existing = [...doc.nodes, ...doc.draftNodes].find(
                (n) => n.id === positioned.id
              );
              return existing
                ? estimateNodeSize(existing)
                : { width: CARD_WIDTH, height: CARD_MIN_HEIGHT };
            })();

    const others = slots
      .filter((s) => s.id !== positioned.id)
      .map(({ x, y, width, height }) => ({ x, y, width, height }));

    const position = resolvePosition(positioned.position, size, others);
    const slot: OccupiedSlot = {
      id: positioned.id,
      x: position.x,
      y: position.y,
      ...size,
    };

    const existingIdx = slots.findIndex((s) => s.id === positioned.id);
    if (existingIdx === -1) slots.push(slot);
    else slots[existingIdx] = slot;

    resolved.push({ ...positioned, position });
  }

  return resolved;
}
