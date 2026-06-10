import type { Edge, Node, Viewport } from "@xyflow/react";

export type EngineMode = "chat" | "canvas";

export type CanvasCardKind =
  | "text"
  | "image"
  | "markdown"
  | "flowchart"
  | "script"
  | "widget";

export type CanvasLayer = "main" | "draft";

/** Data channel binding between connected widget cards. */
export interface CanvasWidgetBinding {
  channel: string;
  sourceKey?: string;
  targetKey?: string;
}

export interface CanvasEdgeData extends Record<string, unknown> {
  bind?: CanvasWidgetBinding;
}

export interface CanvasCardData extends Record<string, unknown> {
  kind: CanvasCardKind;
  title?: string;
  body?: string;
  imageUrl?: string;
  markdown?: string;
  layer: CanvasLayer;
  /** Natural-language spec for the widget HTML builder. */
  widgetSpec?: string;
  /** Cached builder HTML — persisted on the node. */
  widgetHtml?: string;
  widgetHeight?: string;
  /** When true (default), card height/width follow content measurements. */
  autoSize?: boolean;
  cardWidth?: number;
  cardHeight?: number;
}

export type CanvasNode = Node<CanvasCardData>;
export type CanvasEdge = Edge<CanvasEdgeData>;

export interface CanvasDocument {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  draftNodes: CanvasNode[];
  draftEdges: CanvasEdge[];
  viewport: Viewport;
}

export interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Nodes visible inside the current viewport — spatial context for the agent. */
export interface CanvasViewportContext {
  bounds: CanvasBounds;
  zoom: number;
  nodes: Array<{
    id: string;
    kind: CanvasCardKind;
    layer: CanvasLayer;
    position: { x: number; y: number };
    size?: { width: number; height: number };
    title?: string;
    body?: string;
    imageUrl?: string;
    markdown?: string;
    widgetSpec?: string;
    hasWidgetHtml?: boolean;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    bind?: CanvasWidgetBinding;
  }>;
  layout?: {
    cardWidth: number;
    minGap: number;
    columnStride: number;
    rowStride: number;
    suggestedNext: { x: number; y: number };
    occupied: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };
}

export type CanvasPatch =
  | {
      op: "create_node";
      id: string;
      kind: CanvasCardKind;
      position: { x: number; y: number };
      layer?: CanvasLayer;
      title?: string;
      body?: string;
      markdown?: string;
      widgetSpec?: string;
      widgetHeight?: string;
    }
  | {
      op: "update_node";
      id: string;
      position?: { x: number; y: number };
      kind?: CanvasCardKind;
      title?: string;
      body?: string;
      markdown?: string;
      imageUrl?: string;
      widgetSpec?: string;
      widgetHtml?: string;
      widgetHeight?: string;
    }
  | { op: "delete_node"; id: string }
  | {
      op: "draw_arrow";
      id: string;
      source: string;
      target: string;
      label?: string;
      layer?: CanvasLayer;
      bind?: CanvasWidgetBinding;
    }
  | {
      op: "place_image";
      id: string;
      position: { x: number; y: number };
      imageUrl: string;
      title?: string;
      layer?: CanvasLayer;
    }
  | {
      op: "place_widget";
      id: string;
      position: { x: number; y: number };
      spec: string;
      title?: string;
      height?: string;
      layer?: CanvasLayer;
    }
  | { op: "commit_draft" }
  | { op: "clear_draft" };

export interface CanvasPatchEnvelope {
  patches: CanvasPatch[];
}
