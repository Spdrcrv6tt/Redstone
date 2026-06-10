"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Handle,
  NodeResizeControl,
  Position,
  useNodeId,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DynamicWidgetLoader } from "@/components/DynamicWidgetLoader";
import { CanvasCardContextMenu } from "@/components/workspace/CanvasCardContextMenu";
import { CanvasJsonModal } from "@/components/workspace/CanvasJsonModal";
import { useCanvasWidgetBridge } from "@/components/workspace/CanvasWidgetBridge";
import { useCanvasWorkspace } from "@/components/workspace/CanvasWorkspaceContext";
import { resolveCanvasImageSrc } from "@/lib/canvas/image-url";
import { proxiedImagePath } from "@/lib/image-proxy";
import { useAppStore } from "@/lib/store";
import type { CanvasCardData, CanvasNode } from "@/types/canvas";

const CARD_MIN_W = 180;
const CARD_MIN_H = 72;
const CARD_MAX_W = 480;

function CanvasCardNodeComponent({ data, selected }: NodeProps) {
  const card = data as CanvasCardData;
  const nodeId = useNodeId() ?? "";
  const { conversationId } = useCanvasWorkspace();
  const bridge = useCanvasWidgetBridge();
  const { getNode } = useReactFlow();
  const contentRef = useRef<HTMLDivElement>(null);

  const updateCanvasNodeData = useAppStore((s) => s.updateCanvasNodeData);
  const updateCanvasNodeLayout = useAppStore((s) => s.updateCanvasNodeLayout);
  const deleteCanvasNode = useAppStore((s) => s.deleteCanvasNode);

  const isDraft = card.layer === "draft";
  const autoSize = card.autoSize !== false && card.kind !== "widget";
  const width = card.cardWidth ?? CARD_MIN_W;
  const height = card.cardHeight;

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [imgSrc, setImgSrc] = useState(() =>
    resolveCanvasImageSrc(card.imageUrl)
  );

  useEffect(() => {
    setImgSrc(resolveCanvasImageSrc(card.imageUrl));
  }, [card.imageUrl]);

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

  const measureContent = useCallback(() => {
    if (!autoSize || !contentRef.current || !conversationId || !nodeId) {
      return;
    }
    const el = contentRef.current;
    const nextW = Math.min(CARD_MAX_W, Math.max(CARD_MIN_W, el.scrollWidth + 2));
    const nextH = Math.max(CARD_MIN_H, el.scrollHeight + 2);
    if (
      Math.abs((card.cardWidth ?? 0) - nextW) > 2 ||
      Math.abs((card.cardHeight ?? 0) - nextH) > 2
    ) {
      updateCanvasNodeLayout(conversationId, nodeId, {
        width: nextW,
        height: nextH,
        autoSize: true,
      });
    }
  }, [
    autoSize,
    card.cardHeight,
    card.cardWidth,
    conversationId,
    nodeId,
    updateCanvasNodeLayout,
  ]);

  useEffect(() => {
    if (!autoSize || !contentRef.current) return;
    measureContent();
    const ro = new ResizeObserver(() => measureContent());
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [autoSize, measureContent, card.markdown, card.body, card.title, imgSrc]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDelete = () => {
    if (conversationId && nodeId) deleteCanvasNode(conversationId, nodeId);
    setMenu(null);
  };

  const jsonPayload = () => {
    const node = getNode(nodeId) as CanvasNode | undefined;
    return {
      id: nodeId,
      position: node?.position,
      width: node?.width ?? card.cardWidth,
      height: node?.height ?? card.cardHeight,
      data: card,
    };
  };

  return (
    <>
      {selected ? (
        <NodeResizeControl
          position="bottom-right"
          minWidth={CARD_MIN_W}
          minHeight={CARD_MIN_H}
          maxWidth={CARD_MAX_W}
          className="canvas-card-resizer-handle"
          onResizeEnd={(_event, params) => {
            if (!conversationId || !nodeId) return;
            updateCanvasNodeLayout(conversationId, nodeId, {
              width: Math.round(params.width),
              height: Math.round(params.height),
              autoSize: false,
            });
          }}
        />
      ) : null}

      <div
        className={[
          "canvas-card",
          isDraft ? "canvas-card--draft" : "",
          selected ? "canvas-card--selected" : "",
          `canvas-card--${card.kind}`,
        ].join(" ")}
        style={{
          width: width ? `${width}px` : undefined,
          height: height ? `${height}px` : undefined,
        }}
        onContextMenu={handleContextMenu}
      >
        <Handle type="target" position={Position.Left} className="canvas-card-handle" />
        <Handle type="source" position={Position.Right} className="canvas-card-handle" />

        <div ref={contentRef} className="canvas-card-content">
          {card.title ? (
            <p className="canvas-card-title">{card.title}</p>
          ) : null}

          {card.kind === "image" && card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={card.title ?? "Canvas image"}
              className="canvas-card-image"
              onLoad={measureContent}
              onError={() => {
                const raw = card.imageUrl ?? "";
                if (raw && !imgSrc.includes("/api/image-proxy")) {
                  setImgSrc(proxiedImagePath(raw));
                }
              }}
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
              <MarkdownContent
                content={card.markdown}
                className="prose prose-sm max-w-none"
              />
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
      </div>

      {menu ? (
        <CanvasCardContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onDelete={handleDelete}
          onViewJson={() => {
            setMenu(null);
            setShowJson(true);
          }}
        />
      ) : null}

      {showJson ? (
        <CanvasJsonModal
          title={card.title ?? `Card ${nodeId}`}
          payload={jsonPayload()}
          onClose={() => setShowJson(false)}
        />
      ) : null}
    </>
  );
}

export const CanvasCardNode = memo(CanvasCardNodeComponent);
