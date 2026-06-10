"use client";

import { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { InputComposer } from "@/components/InputComposer";
import { EngineModeToggle } from "@/components/EngineModeToggle";
import { WorkspaceCanvas } from "@/components/workspace/WorkspaceCanvas";
import { useWorkspaceChat } from "@/hooks/useWorkspaceChat";
import { buildViewportContext } from "@/lib/canvas/viewport-context";
import { EMPTY_CANVAS } from "@/lib/canvas/defaults";
import { useAppStore } from "@/lib/store";
import type { MessageAttachment } from "@/types";
import type { Viewport } from "@xyflow/react";

interface WorkspaceViewProps {
  conversationId: string;
  onEnsureConversation: () => string;
  isMobile: boolean;
}

export function WorkspaceView({
  conversationId,
  onEnsureConversation,
  isMobile,
}: WorkspaceViewProps) {
  const settings = useAppStore((s) => s.settings);
  const getCanvas = useAppStore((s) => s.getCanvas);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const paneSizeRef = useRef({ width: 800, height: 600 });

  const { sendMessage, stop, isStreaming } = useWorkspaceChat(conversationId);

  const handleViewportChange = useCallback(
    (viewport: Viewport, width: number, height: number) => {
      viewportRef.current = viewport;
      paneSizeRef.current = { width, height };
    },
    []
  );

  const handleSend = useCallback(
    (content: string, attachments: MessageAttachment[] = []) => {
      if (!settings.defaultModel) return;
      const hasContent = content.trim().length > 0 || attachments.length > 0;
      if (!hasContent) return;

      const id = conversationId || onEnsureConversation();
      const doc = getCanvas(id) ?? EMPTY_CANVAS;
      const spatial = buildViewportContext(
        doc,
        viewportRef.current,
        paneSizeRef.current.width,
        paneSizeRef.current.height
      );

      sendMessage(content, attachments, spatial);
    },
    [
      conversationId,
      getCanvas,
      onEnsureConversation,
      sendMessage,
      settings.defaultModel,
    ]
  );

  return (
    <div className="workspace-view flex flex-col flex-1 min-h-0 min-w-0">
      <div className="workspace-toolbar flex items-center justify-between gap-3 px-3 sm:px-5 py-2 flex-shrink-0 border-b border-theme">
        <EngineModeToggle compact={isMobile} />
        <p className="workspace-toolbar-hint text-xs text-muted hidden sm:block">
          Pan the canvas — the agent only sees cards in your viewport
        </p>
      </div>

      <WorkspaceCanvas
        conversationId={conversationId}
        onViewportChange={handleViewportChange}
      />

      <motion.div
        className="workspace-composer-wrap flex-shrink-0 w-full mx-auto border-t border-theme"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <InputComposer
          key={conversationId}
          onSend={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
          autoFocus={!isMobile}
          placeholder={
            isMobile
              ? "Instruct the canvas…"
              : "Instruct the canvas — spatial context follows your viewport"
          }
        />
      </motion.div>
    </div>
  );
}
