"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeDiagramHtml } from "@/lib/diagram";

interface LegacyHtmlDiagramProps {
  htmlContent: string;
  className?: string;
}

const MIN_HEIGHT = 240;
const MAX_HEIGHT = 720;

/** Sandboxed iframe fallback for legacy HTML diagram payloads. */
export function LegacyHtmlDiagram({
  htmlContent,
  className = "",
}: LegacyHtmlDiagramProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(360);

  const srcDoc = useMemo(
    () => normalizeDiagramHtml(htmlContent),
    [htmlContent]
  );

  const clampHeight = useCallback((value: number) => {
    return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value + 16));
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; height?: number };
      if (
        data?.type === "redstone-diagram-height" &&
        typeof data.height === "number"
      ) {
        setHeight(clampHeight(data.height));
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [clampHeight]);

  return (
    <div
      className={`diagram-card my-4 overflow-hidden rounded-2xl border border-theme bg-surface-muted shadow-sm ${className}`}
    >
      <iframe
        ref={iframeRef}
        title="Interactive diagram"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        className="block w-full border-0 bg-white dark:bg-zinc-950"
        style={{ height }}
        loading="lazy"
      />
    </div>
  );
}
