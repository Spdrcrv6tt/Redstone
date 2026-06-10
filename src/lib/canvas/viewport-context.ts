import {
  CARD_WIDTH,
  COLUMN_STRIDE,
  LAYOUT_GAP,
  ROW_STRIDE,
  estimateNodeSize,
  occupiedRects,
  suggestNextPosition,
} from "@/lib/canvas/layout";
import type {
  CanvasBounds,
  CanvasDocument,
  CanvasViewportContext,
} from "@/types/canvas";
import type { Viewport } from "@xyflow/react";

/** Convert screen-space viewport to flow coordinates (approximate visible bounds). */
export function viewportToFlowBounds(
  viewport: Viewport,
  width: number,
  height: number
): CanvasBounds {
  const zoom = viewport.zoom || 1;
  return {
    x: -viewport.x / zoom,
    y: -viewport.y / zoom,
    width: width / zoom,
    height: height / zoom,
  };
}

function nodeIntersectsBounds(
  position: { x: number; y: number },
  nodeW: number,
  nodeH: number,
  bounds: CanvasBounds
): boolean {
  const nx = position.x;
  const ny = position.y;
  return (
    nx + nodeW >= bounds.x &&
    nx <= bounds.x + bounds.width &&
    ny + nodeH >= bounds.y &&
    ny <= bounds.y + bounds.height
  );
}

export function buildViewportContext(
  doc: CanvasDocument,
  viewport: Viewport,
  paneWidth: number,
  paneHeight: number
): CanvasViewportContext {
  const bounds = viewportToFlowBounds(viewport, paneWidth, paneHeight);

  const allNodes = [...doc.nodes, ...doc.draftNodes];
  const allEdges = [...doc.edges, ...doc.draftEdges];
  const allOccupied = occupiedRects(doc);

  const visibleIds = new Set<string>();

  const nodes = allNodes
    .filter((n) => {
      const size = estimateNodeSize(n);
      return nodeIntersectsBounds(
        n.position,
        size.width,
        size.height,
        bounds
      );
    })
    .map((n) => {
      visibleIds.add(n.id);
      const size = estimateNodeSize(n);
      return {
        id: n.id,
        kind: n.data.kind,
        layer: n.data.layer,
        position: { x: n.position.x, y: n.position.y },
        size,
        title: n.data.title,
        body: n.data.body,
        imageUrl: n.data.imageUrl,
        markdown: n.data.markdown,
        widgetSpec: n.data.widgetSpec,
        hasWidgetHtml: !!n.data.widgetHtml,
      };
    });

  const edges = allEdges
    .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : undefined,
      bind: e.data?.bind,
    }));

  const suggestedNext = suggestNextPosition(bounds, allOccupied);

  return {
    bounds,
    zoom: viewport.zoom,
    nodes,
    edges,
    layout: {
      cardWidth: CARD_WIDTH,
      minGap: LAYOUT_GAP,
      columnStride: COLUMN_STRIDE,
      rowStride: ROW_STRIDE,
      suggestedNext,
      occupied: allOccupied.map((r) => ({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      })),
    },
  };
}
