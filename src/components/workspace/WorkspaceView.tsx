"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { InputComposer } from "@/components/InputComposer";
import { WorkspaceCanvas } from "@/components/workspace/WorkspaceCanvas";
import { useWorkspaceChat } from "@/hooks/useWorkspaceChat";
import { buildViewportContext } from "@/lib/canvas/viewport-context";
import { EMPTY_CANVAS } from "@/lib/canvas/defaults";
import { useAppStore } from "@/lib/store";
import type { MessageAttachment } from "@/types";
import type { Viewport } from "@xyflow/react";

interface WorkspaceViewProps {
  conversationId: string;
  isMobile: boolean;
  pendingMessage?: {
    content: string;
    attachments: MessageAttachment[];
  } | null;
  onPendingMessageSent?: () => void;
}

export function WorkspaceView({
  conversationId,
  isMobile,
  pendingMessage,
  onPendingMessageSent,
}: WorkspaceViewProps) {
  const settings = useAppStore((s) => s.settings);
  const getCanvas = useAppStore((s) => s.getCanvas);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const paneSizeRef = useRef({ width: 800, height: 600 });
  const pendingHandledRef = useRef(false);

  const { sendMessage, stop, isStreaming, isThinking } =
    useWorkspaceChat(conversationId);

  const handleViewportChange = useCallback(
    (viewport: Viewport, width: number, height: number) => {
      viewportRef.current = viewport;
      paneSizeRef.current = { width, height };
    },
    []
  );

  const dispatchSend = useCallback(
    (content: string, attachments: MessageAttachment[] = []) => {
      if (!settings.defaultModel) return;
      const doc = getCanvas(conversationId) ?? EMPTY_CANVAS;
      const spatial = buildViewportContext(
        doc,
        viewportRef.current,
        paneSizeRef.current.width,
        paneSizeRef.current.height
      );
      sendMessage(content, attachments, spatial);
    },
    [conversationId, getCanvas, sendMessage, settings.defaultModel]
  );

  const handleSend = useCallback(
    (content: string, attachments: MessageAttachment[] = []) => {
      if (!settings.defaultModel) return;
      const hasContent = content.trim().length > 0 || attachments.length > 0;
      if (!hasContent) return;
      dispatchSend(content, attachments);
    },
    [dispatchSend, settings.defaultModel]
  );

  useEffect(() => {
    if (!pendingMessage || pendingHandledRef.current) return;
    pendingHandledRef.current = true;
    const { content, attachments } = pendingMessage;
    const timer = window.setTimeout(() => {
      dispatchSend(content, attachments);
      onPendingMessageSent?.();
    }, 80);
    return () => clearTimeout(timer);
  }, [pendingMessage, dispatchSend, onPendingMessageSent]);

  useEffect(() => {
    pendingHandledRef.current = false;
  }, [conversationId]);

  return (
    <div className="workspace-view">
      <WorkspaceCanvas
        conversationId={conversationId}
        onViewportChange={handleViewportChange}
      />

      <motion.div
        className="workspace-composer-overlay"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <InputComposer
          key={conversationId}
          onSend={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
          isThinking={isThinking}
          layout="canvas"
          autoFocus={!isMobile}
          placeholder="Instruct the canvas…"
        />
      </motion.div>
    </div>
  );
}
