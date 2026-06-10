"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  routeWidgetEmit,
  type WidgetEmitMessage,
} from "@/lib/canvas/widget-bridge";
import { useAppStore } from "@/lib/store";

interface CanvasWidgetBridgeContextValue {
  register: (nodeId: string, win: Window) => void;
  unregister: (nodeId: string) => void;
}

const CanvasWidgetBridgeContext =
  createContext<CanvasWidgetBridgeContextValue | null>(null);

export function useCanvasWidgetBridge() {
  return useContext(CanvasWidgetBridgeContext);
}

export function CanvasWidgetBridge({
  conversationId,
  children,
}: {
  conversationId: string;
  children: ReactNode;
}) {
  const registryRef = useRef(new Map<string, Window>());
  const canvas = useAppStore(
    (s) => s.conversations.find((c) => c.id === conversationId)?.canvas
  );

  const register = useCallback((nodeId: string, win: Window) => {
    registryRef.current.set(nodeId, win);
  }, []);

  const unregister = useCallback((nodeId: string) => {
    registryRef.current.delete(nodeId);
  }, []);

  const value = useMemo(
    () => ({ register, unregister }),
    [register, unregister]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as WidgetEmitMessage | undefined;
      if (data?.type !== "redstone-widget-emit" || !data.nodeId || !data.channel) {
        return;
      }
      if (!canvas) return;

      routeWidgetEmit(canvas, data, (targetId, message) => {
        const targetWin = registryRef.current.get(targetId);
        targetWin?.postMessage(message, "*");
      });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [canvas]);

  return (
    <CanvasWidgetBridgeContext.Provider value={value}>
      {children}
    </CanvasWidgetBridgeContext.Provider>
  );
}
