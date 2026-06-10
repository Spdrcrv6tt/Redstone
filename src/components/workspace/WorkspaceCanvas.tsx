"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnMove,
  type OnNodesChange,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CanvasCardNode } from "@/components/workspace/nodes/CanvasCardNode";
import { EMPTY_CANVAS } from "@/lib/canvas/defaults";
import { useAppStore } from "@/lib/store";
import type { CanvasCardData, CanvasDocument } from "@/types/canvas";

const nodeTypes = { canvasCard: CanvasCardNode };

interface WorkspaceCanvasInnerProps {
  conversationId: string;
  onViewportChange?: (viewport: Viewport, width: number, height: number) => void;
}

function mergeFlowNodes(doc: CanvasDocument): Node<CanvasCardData>[] {
  return [...doc.nodes, ...doc.draftNodes];
}

function mergeFlowEdges(doc: CanvasDocument): Edge[] {
  return [...doc.edges, ...doc.draftEdges];
}

function splitNodes(all: Node<CanvasCardData>[]) {
  const nodes: Node<CanvasCardData>[] = [];
  const draftNodes: Node<CanvasCardData>[] = [];
  for (const n of all) {
    if ((n.data as CanvasCardData).layer === "draft") {
      draftNodes.push(n);
    } else {
      nodes.push(n);
    }
  }
  return { nodes, draftNodes };
}

function splitEdges(all: Edge[], doc: CanvasDocument) {
  const draftIds = new Set(doc.draftEdges.map((e) => e.id));
  const edges = all.filter((e) => !draftIds.has(e.id));
  const draftEdges = all.filter((e) => draftIds.has(e.id));
  return { edges, draftEdges };
}

function WorkspaceCanvasInner({
  conversationId,
  onViewportChange,
}: WorkspaceCanvasInnerProps) {
  const canvas = useAppStore(
    (s) => s.conversations.find((c) => c.id === conversationId)?.canvas
  );
  const setCanvasDocument = useAppStore((s) => s.setCanvasDocument);

  const doc = canvas ?? EMPTY_CANVAS;
  const nodes = useMemo(() => mergeFlowNodes(doc), [doc]);
  const edges = useMemo(() => mergeFlowEdges(doc), [doc]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const nextAll = applyNodeChanges(changes, nodes) as Node<CanvasCardData>[];
      const { nodes: main, draftNodes } = splitNodes(nextAll);
      setCanvasDocument(conversationId, {
        ...doc,
        nodes: main,
        draftNodes,
      });
    },
    [conversationId, doc, nodes, setCanvasDocument]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const nextAll = applyEdgeChanges(changes, edges);
      const { edges: main, draftEdges } = splitEdges(nextAll, doc);
      setCanvasDocument(conversationId, {
        ...doc,
        edges: main,
        draftEdges,
      });
    },
    [conversationId, doc, edges, setCanvasDocument]
  );

  const onMove: OnMove = useCallback(
    (_event, viewport) => {
      setCanvasDocument(conversationId, { ...doc, viewport });
      const el = document.querySelector(".workspace-canvas-pane");
      const rect = el?.getBoundingClientRect();
      onViewportChange?.(
        viewport,
        rect?.width ?? 800,
        rect?.height ?? 600
      );
    },
    [conversationId, doc, onViewportChange, setCanvasDocument]
  );

  const hasDraft = doc.draftNodes.length > 0 || doc.draftEdges.length > 0;

  return (
    <div className="workspace-canvas-pane flex-1 min-h-0 relative">
      {hasDraft ? (
        <div className="workspace-draft-badge" aria-live="polite">
          Draft layer active
        </div>
      ) : null}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMove={onMove}
        defaultViewport={doc.viewport}
        fitView={nodes.length === 0}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="workspace-flow"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="workspace-flow-bg"
        />
        <Controls className="workspace-flow-controls" showInteractive={false} />
        <MiniMap
          className="workspace-flow-minimap"
          pannable
          zoomable
          nodeColor={(n) =>
            (n.data as CanvasCardData).layer === "draft" ? "#a78bfa" : "#6366f1"
          }
        />
      </ReactFlow>
    </div>
  );
}

export function WorkspaceCanvas(props: WorkspaceCanvasInnerProps) {
  return (
    <ReactFlowProvider>
      <WorkspaceCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
