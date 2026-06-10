"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { normalizeDiagramHtml } from "@/lib/diagram";

interface DynamicWidgetLoaderProps {
  spec: string;
  height?: string;
  model?: string;
  cachedHtml?: string;
  onBuilt?: (html: string) => void;
  /** Canvas card node id — enables inter-widget messaging bridge. */
  nodeId?: string;
  variant?: "chat" | "canvas";
  onIframeReady?: (win: Window) => void;
  /** Stretch iframe to the card content area (manual resize). */
  fillContainer?: boolean;
  /** Report intrinsic height while the card is auto-sizing. */
  autoMeasure?: boolean;
  onMeasuredHeight?: (height: number) => void;
}

export function DynamicWidgetLoader({
  spec,
  height = "65vh",
  model: modelProp,
  cachedHtml,
  onBuilt,
  nodeId,
  variant = "chat",
  onIframeReady,
  fillContainer = false,
  autoMeasure = false,
  onMeasuredHeight,
}: DynamicWidgetLoaderProps) {
  const settings = useAppStore((s) => s.settings);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onBuiltRef = useRef(onBuilt);
  const onIframeReadyRef = useRef(onIframeReady);
  const onMeasuredHeightRef = useRef(onMeasuredHeight);
  onBuiltRef.current = onBuilt;
  onIframeReadyRef.current = onIframeReady;
  onMeasuredHeightRef.current = onMeasuredHeight;
  const [html, setHtml] = useState<string | null>(cachedHtml ?? null);
  const [loading, setLoading] = useState(!cachedHtml);
  const [error, setError] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState(height);

  const model = modelProp ?? settings.defaultModel;
  const isCanvas = variant === "canvas";

  useEffect(() => {
    if (cachedHtml) {
      setHtml(cachedHtml);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function buildWidget() {
      setLoading(true);
      setError(null);
      setHtml(null);

      try {
        const res = await fetch("/api/widget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spec,
            model,
            _host: settings.ollamaHost,
            _apiKey: settings.apiKey,
          }),
        });

        const data = (await res.json()) as { html?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? `Build failed (${res.status})`);
        }
        if (!data.html?.trim()) {
          throw new Error("Builder returned empty HTML");
        }
        if (!cancelled) {
          setHtml(data.html);
          onBuiltRef.current?.(data.html);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Widget build failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void buildWidget();
    return () => {
      cancelled = true;
    };
  }, [cachedHtml, spec, model, settings.ollamaHost, settings.apiKey]);

  const srcDoc = useMemo(
    () =>
      html
        ? normalizeDiagramHtml(html, {
            widgetViewport: true,
            canvasNodeId: nodeId,
          })
        : "",
    [html, nodeId]
  );

  const resolveHeightPx = useCallback((h: string) => {
    if (typeof window === "undefined") return 520;
    const vh = h.match(/^([\d.]+)vh$/i);
    if (vh) return (window.innerHeight * Number.parseFloat(vh[1])) / 100;
    const px = Number.parseInt(h, 10);
    return Number.isFinite(px) ? px : 520;
  }, []);

  const clampHeight = useCallback(
    (value: number) => {
      if (isCanvas && (autoMeasure || fillContainer)) {
        return Math.max(200, value);
      }
      const target = resolveHeightPx(height);
      if (isCanvas) return Math.min(target, Math.max(200, value));
      const maxOnScreen =
        typeof window !== "undefined" ? window.innerHeight * 0.85 : target;
      return Math.min(maxOnScreen, target, Math.max(240, value));
    },
    [autoMeasure, fillContainer, height, isCanvas, resolveHeightPx]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; height?: number };
      if (
        data?.type === "redstone-diagram-height" &&
        typeof data.height === "number"
      ) {
        const next = clampHeight(data.height);
        if (autoMeasure) {
          onMeasuredHeightRef.current?.(next);
        }
        if (!fillContainer) {
          setIframeHeight(`${next}px`);
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [autoMeasure, clampHeight, fillContainer]);

  const handleIframeLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (win) onIframeReadyRef.current?.(win);
  }, []);

  if (loading) {
    return (
      <div
        style={{ height: isCanvas ? height : height, background: "#1a1d26" }}
        className={
          isCanvas
            ? "canvas-widget-loader canvas-widget-loader--loading"
            : "diagram-card my-4 animate-pulse flex items-center justify-center rounded-xl border border-theme text-muted text-sm"
        }
      >
        Building interactive widget…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ minHeight: height, background: "#1a1d26" }}
        className={
          isCanvas
            ? "canvas-widget-loader canvas-widget-loader--error"
            : "diagram-card my-4 flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400"
        }
      >
        {error}
      </div>
    );
  }

  if (isCanvas) {
    return (
      <iframe
        ref={iframeRef}
        title={spec.slice(0, 80) || "Interactive widget"}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
        onLoad={handleIframeLoad}
        className={[
          "canvas-widget-iframe",
          fillContainer ? "canvas-widget-iframe--fill" : "",
        ].join(" ")}
        style={fillContainer ? undefined : { height: iframeHeight }}
        loading="lazy"
      />
    );
  }

  return (
    <div className="diagram-card my-4 overflow-hidden rounded-xl border border-theme shadow-sm">
      <iframe
        ref={iframeRef}
        title="Interactive widget"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
        onLoad={handleIframeLoad}
        style={{
          width: "100%",
          height: iframeHeight,
          border: "none",
          borderRadius: "12px",
          background: "#0f1117",
        }}
        loading="lazy"
      />
    </div>
  );
}

export function WidgetArchitectPending() {
  return (
    <div className="diagram-card my-4 flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-theme bg-surface-muted/60">
      <p className="text-sm text-muted">Architecting widget…</p>
    </div>
  );
}
