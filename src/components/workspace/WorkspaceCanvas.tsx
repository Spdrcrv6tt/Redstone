"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
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
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CanvasWidgetBridge } from "@/components/workspace/CanvasWidgetBridge";
import { CanvasWorkspaceContext } from "@/components/workspace/CanvasWorkspaceContext";
import { CanvasCardNode } from "@/components/workspace/nodes/CanvasCardNode";
import { EMPTY_CANVAS } from "@/lib/canvas/defaults";
import { MAX_FILES, processFile } from "@/lib/files";
import { useAppStore } from "@/lib/store";
import { generateId } from "@/lib/utils";
import type { CanvasCardData, CanvasDocument, CanvasPatch } from "@/types/canvas";

const nodeTypes = { canvasCard: CanvasCardNode };

interface WorkspaceCanvasInnerProps {
  conversationId: string;
  onViewportChange?: (viewport: Viewport, width: number, height: number) => void;
}

function mergeFlowNodes(doc: CanvasDocument): Node<CanvasCardData>[] {
  return [...doc.nodes, ...doc.draftNodes].map((n) => ({
    ...n,
    width: n.width ?? n.data.cardWidth,
    height: n.height ?? n.data.cardHeight,
  }));
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
  const applyCanvasPatches = useAppStore((s) => s.applyCanvasPatches);

  const flowRef = useRef<ReactFlowInstance<
    Node<CanvasCardData>,
    Edge
  > | null>(null);
  const dragDepthRef = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  const doc = canvas ?? EMPTY_CANVAS;
  const nodes = useMemo(() => mergeFlowNodes(doc), [doc]);
  const edges = useMemo(() => mergeFlowEdges(doc), [doc]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const nextAll = applyNodeChanges(changes, nodes) as Node<CanvasCardData>[];
      const synced = nextAll.map((n) => {
        const w = n.width ?? n.data.cardWidth;
        const h = n.height ?? n.data.cardHeight;
        const dimChange = changes.some(
          (c) => c.type === "dimensions" && "id" in c && c.id === n.id
        );
        if (!dimChange || (w === n.data.cardWidth && h === n.data.cardHeight)) {
          return n;
        }
        return {
          ...n,
          width: w,
          height: h,
          data: {
            ...n.data,
            cardWidth: w,
            cardHeight: h,
            autoSize: false,
          },
        };
      });
      const { nodes: main, draftNodes } = splitNodes(synced);
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

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (!files.length || !flowRef.current) return;

      const position = flowRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const patches: CanvasPatch[] = [];
      let offset = 0;

      for (const file of files.slice(0, MAX_FILES)) {
        try {
          const att = await processFile(file);
          const id = `drop-${generateId()}`;
          const pos = { x: position.x + offset, y: position.y + offset };

          if (att.previewUrl) {
            patches.push({
              op: "place_image",
              id,
              position: pos,
              imageUrl: att.previewUrl,
              title: att.name,
            });
          } else if (att.textContent) {
            patches.push({
              op: "create_node",
              id,
              kind: "markdown",
              position: pos,
              title: att.name,
              markdown: att.textContent.slice(0, 12000),
            });
          }
          offset += 48;
        } catch {
          /* skip unsupported files */
        }
      }

      if (patches.length) {
        applyCanvasPatches(conversationId, patches);
      }
    },
    [applyCanvasPatches, conversationId]
  );

  const hasDraft = doc.draftNodes.length > 0 || doc.draftEdges.length > 0;

  return (
    <div
      className="workspace-canvas-pane"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {hasDraft ? (
        <div className="workspace-draft-badge" aria-live="polite">
          Draft layer
        </div>
      ) : null}

      {dragOver ? (
        <div className="workspace-drop-overlay" aria-hidden>
          <ImageIcon className="w-5 h-5" strokeWidth={1.75} />
          <span>Drop to place on canvas</span>
        </div>
      ) : null}

      <CanvasWorkspaceContext.Provider value={{ conversationId }}>
        <CanvasWidgetBridge conversationId={conversationId}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onMove={onMove}
            onInit={(instance) => {
              flowRef.current = instance;
            }}
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
                (n.data as CanvasCardData).layer === "draft"
                  ? "#a78bfa"
                  : (n.data as CanvasCardData).kind === "widget"
                    ? "#22d3ee"
                    : "#6366f1"
              }
            />
          </ReactFlow>
        </CanvasWidgetBridge>
      </CanvasWorkspaceContext.Provider>
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
