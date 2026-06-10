import type { Edge, Node, Viewport } from "@xyflow/react";

export type EngineMode = "chat" | "canvas";

export type CanvasCardKind =
  | "text"
  | "image"
  | "markdown"
  | "flowchart"
  | "script";

export type CanvasLayer = "main" | "draft";

export interface CanvasCardData extends Record<string, unknown> {
  kind: CanvasCardKind;
  title?: string;
  body?: string;
  imageUrl?: string;
  markdown?: string;
  layer: CanvasLayer;
}

export type CanvasNode = Node<CanvasCardData>;
export type CanvasEdge = Edge;

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
    title?: string;
    body?: string;
    imageUrl?: string;
    markdown?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
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
    }
  | { op: "delete_node"; id: string }
  | {
      op: "draw_arrow";
      id: string;
      source: string;
      target: string;
      label?: string;
      layer?: CanvasLayer;
    }
  | {
      op: "place_image";
      id: string;
      position: { x: number; y: number };
      imageUrl: string;
      title?: string;
      layer?: CanvasLayer;
    }
  | { op: "commit_draft" }
  | { op: "clear_draft" };

export interface CanvasPatchEnvelope {
  patches: CanvasPatch[];
}
