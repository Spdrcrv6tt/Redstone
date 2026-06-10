"use client";

import { memo, useCallback, useEffect } from "react";
import { Handle, Position, useNodeId, type NodeProps } from "@xyflow/react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DynamicWidgetLoader } from "@/components/DynamicWidgetLoader";
import { useCanvasWidgetBridge } from "@/components/workspace/CanvasWidgetBridge";
import { useCanvasWorkspace } from "@/components/workspace/CanvasWorkspaceContext";
import { useAppStore } from "@/lib/store";
import type { CanvasCardData } from "@/types/canvas";

function CanvasCardNodeComponent({ data, selected }: NodeProps) {
  const card = data as CanvasCardData;
  const nodeId = useNodeId() ?? "";
  const { conversationId } = useCanvasWorkspace();
  const bridge = useCanvasWidgetBridge();
  const updateCanvasNodeData = useAppStore((s) => s.updateCanvasNodeData);
  const isDraft = card.layer === "draft";

  const handleWidgetBuilt = useCallback(
    (html: string) => {
      if (!conversationId || !nodeId) return;
      updateCanvasNodeData(conversationId, nodeId, { widgetHtml: html });
    },
    [conversationId, nodeId, updateCanvasNodeData]
  );

  const handleIframeReady = useCallback(
    (win: Window) => {
      if (!nodeId) return;
      bridge?.register(nodeId, win);
    },
    [bridge, nodeId]
  );

  useEffect(() => {
    return () => {
      if (nodeId) bridge?.unregister(nodeId);
    };
  }, [bridge, nodeId]);

  return (
    <div
      className={[
        "canvas-card",
        isDraft ? "canvas-card--draft" : "",
        selected ? "canvas-card--selected" : "",
        `canvas-card--${card.kind}`,
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} className="canvas-card-handle" />
      <Handle type="source" position={Position.Right} className="canvas-card-handle" />

      {card.title ? (
        <p className="canvas-card-title">{card.title}</p>
      ) : null}

      {card.kind === "image" && card.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.imageUrl}
          alt={card.title ?? "Canvas image"}
          className="canvas-card-image"
        />
      ) : null}

      {card.kind === "widget" && card.widgetSpec ? (
        <DynamicWidgetLoader
          variant="canvas"
          nodeId={nodeId}
          spec={card.widgetSpec}
          height={card.widgetHeight ?? "280px"}
          cachedHtml={card.widgetHtml}
          onBuilt={handleWidgetBuilt}
          onIframeReady={handleIframeReady}
        />
      ) : null}

      {card.markdown ? (
        <div className="canvas-card-markdown">
          <MarkdownContent content={card.markdown} className="prose prose-sm max-w-none" />
        </div>
      ) : card.body ? (
        <p className="canvas-card-body">{card.body}</p>
      ) : null}

      {card.kind === "flowchart" ? (
        <p className="canvas-card-meta">Flowchart subtree</p>
      ) : null}

      {card.kind === "script" ? (
        <p className="canvas-card-meta">Interactive script card</p>
      ) : null}
    </div>
  );
}

export const CanvasCardNode = memo(CanvasCardNodeComponent);
