import type { CanvasDocument } from "@/types/canvas";

export const EMPTY_CANVAS: CanvasDocument = {
  nodes: [],
  edges: [],
  draftNodes: [],
  draftEdges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};
