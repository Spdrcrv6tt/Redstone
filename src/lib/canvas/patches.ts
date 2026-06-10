import { EMPTY_CANVAS } from "@/lib/canvas/defaults";
import { resolvePatchLayout } from "@/lib/canvas/layout";
import type {
  CanvasDocument,
  CanvasLayer,
  CanvasNode,
  CanvasPatch,
} from "@/types/canvas";

function layerArrays(doc: CanvasDocument, layer: CanvasLayer) {
  return layer === "draft"
    ? { nodes: doc.draftNodes, edges: doc.draftEdges }
    : { nodes: doc.nodes, edges: doc.edges };
}

function findNodeIndex(nodes: CanvasNode[], id: string) {
  return nodes.findIndex((n) => n.id === id);
}

function upsertNode(
  nodes: CanvasNode[],
  node: CanvasNode
): CanvasNode[] {
  const idx = findNodeIndex(nodes, node.id);
  if (idx === -1) return [...nodes, node];
  const next = [...nodes];
  next[idx] = { ...next[idx], ...node, data: { ...next[idx].data, ...node.data } };
  return next;
}

function removeNode(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes.filter((n) => n.id !== id);
}

function removeEdgesForNode(
  edges: CanvasDocument["edges"],
  nodeId: string
): CanvasDocument["edges"] {
  return edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
}

export function applyCanvasPatch(
  doc: CanvasDocument,
  patch: CanvasPatch
): CanvasDocument {
  const base = doc ?? EMPTY_CANVAS;
  let next: CanvasDocument = { ...base };

  switch (patch.op) {
    case "create_node": {
      const layer = patch.layer ?? "main";
      const node: CanvasNode = {
        id: patch.id,
        type: "canvasCard",
        position: patch.position,
        data: {
          kind: patch.kind,
          layer,
          title: patch.title,
          body: patch.body,
          markdown: patch.markdown,
          ...(patch.kind === "widget" || patch.widgetSpec
            ? {
                widgetSpec: patch.widgetSpec,
                widgetHeight: patch.widgetHeight ?? "280px",
              }
            : {}),
        },
      };
      if (layer === "draft") {
        next.draftNodes = upsertNode(next.draftNodes, node);
      } else {
        next.nodes = upsertNode(next.nodes, node);
      }
      break;
    }
    case "update_node": {
      const allLayers: CanvasLayer[] = ["main", "draft"];
      for (const layer of allLayers) {
        const { nodes } = layerArrays(next, layer);
        const idx = findNodeIndex(nodes, patch.id);
        if (idx === -1) continue;
        const existing = nodes[idx];
        const updated: CanvasNode = {
          ...existing,
          position: patch.position ?? existing.position,
          data: {
            ...existing.data,
            ...(patch.kind ? { kind: patch.kind } : {}),
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.body !== undefined ? { body: patch.body } : {}),
            ...(patch.markdown !== undefined ? { markdown: patch.markdown } : {}),
            ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
            ...(patch.widgetSpec !== undefined
              ? { widgetSpec: patch.widgetSpec }
              : {}),
            ...(patch.widgetHtml !== undefined
              ? { widgetHtml: patch.widgetHtml }
              : {}),
            ...(patch.widgetHeight !== undefined
              ? { widgetHeight: patch.widgetHeight }
              : {}),
          },
        };
        if (layer === "draft") {
          next.draftNodes = upsertNode(next.draftNodes, updated);
        } else {
          next.nodes = upsertNode(next.nodes, updated);
        }
        break;
      }
      break;
    }
    case "delete_node": {
      next.nodes = removeNode(next.nodes, patch.id);
      next.draftNodes = removeNode(next.draftNodes, patch.id);
      next.edges = removeEdgesForNode(next.edges, patch.id);
      next.draftEdges = removeEdgesForNode(next.draftEdges, patch.id);
      break;
    }
    case "draw_arrow": {
      const layer = patch.layer ?? "main";
      const hasBind = !!patch.bind;
      const edge = {
        id: patch.id,
        source: patch.source,
        target: patch.target,
        label: patch.label ?? patch.bind?.channel,
        type: "smoothstep" as const,
        animated: hasBind || layer === "draft",
        data: patch.bind ? { bind: patch.bind } : undefined,
        style: hasBind
          ? { stroke: "#22d3ee", strokeWidth: 2 }
          : undefined,
      };
      if (layer === "draft") {
        next.draftEdges = [...next.draftEdges.filter((e) => e.id !== patch.id), edge];
      } else {
        next.edges = [...next.edges.filter((e) => e.id !== patch.id), edge];
      }
      break;
    }
    case "place_widget": {
      const layer = patch.layer ?? "main";
      const node: CanvasNode = {
        id: patch.id,
        type: "canvasCard",
        position: patch.position,
        data: {
          kind: "widget",
          layer,
          title: patch.title,
          widgetSpec: patch.spec,
          widgetHeight: patch.height ?? "280px",
          autoSize: false,
          cardWidth: 300,
          cardHeight: 300,
        },
      };
      if (layer === "draft") {
        next.draftNodes = upsertNode(next.draftNodes, node);
      } else {
        next.nodes = upsertNode(next.nodes, node);
      }
      break;
    }
    case "place_image": {
      const layer = patch.layer ?? "main";
      const node: CanvasNode = {
        id: patch.id,
        type: "canvasCard",
        position: patch.position,
        data: {
          kind: "image",
          layer,
          title: patch.title,
          imageUrl: patch.imageUrl,
        },
      };
      if (layer === "draft") {
        next.draftNodes = upsertNode(next.draftNodes, node);
      } else {
        next.nodes = upsertNode(next.nodes, node);
      }
      break;
    }
    case "commit_draft": {
      const promoted = next.draftNodes.map((n) => ({
        ...n,
        data: { ...n.data, layer: "main" as const },
      }));
      const promotedEdges = next.draftEdges.map((e) => ({
        ...e,
        animated: false,
      }));
      next = {
        ...next,
        nodes: [...next.nodes, ...promoted],
        edges: [...next.edges, ...promotedEdges],
        draftNodes: [],
        draftEdges: [],
      };
      break;
    }
    case "clear_draft": {
      next.draftNodes = [];
      next.draftEdges = [];
      break;
    }
    default:
      break;
  }

  return next;
}

export function applyCanvasPatches(
  doc: CanvasDocument,
  patches: CanvasPatch[]
): CanvasDocument {
  const base = doc ?? EMPTY_CANVAS;
  const laidOut = resolvePatchLayout(base, patches);
  return laidOut.reduce(applyCanvasPatch, base);
}
