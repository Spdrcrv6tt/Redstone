"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { normalizeDiagramHtml } from "@/lib/diagram";

interface DynamicWidgetLoaderProps {
  spec: string;
  height?: string;
  model?: string;
}

export function DynamicWidgetLoader({
  spec,
  height = "600px",
  model: modelProp,
}: DynamicWidgetLoaderProps) {
  const settings = useAppStore((s) => s.settings);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState(height);

  const model = modelProp ?? settings.defaultModel;

  useEffect(() => {
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
        if (!cancelled) setHtml(data.html);
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
  }, [spec, model, settings.ollamaHost, settings.apiKey]);

  const srcDoc = useMemo(
    () => (html ? normalizeDiagramHtml(html) : ""),
    [html]
  );

  const clampHeight = useCallback(
    (value: number) => {
      const parsed = Number.parseInt(height, 10);
      const max = Number.isFinite(parsed) ? parsed + 80 : 720;
      return Math.min(max, Math.max(240, value + 16));
    },
    [height]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; height?: number };
      if (
        data?.type === "redstone-diagram-height" &&
        typeof data.height === "number"
      ) {
        setIframeHeight(`${clampHeight(data.height)}px`);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [clampHeight]);

  if (loading) {
    return (
      <div
        style={{ height, background: "#1a1d26" }}
        className="diagram-card my-4 animate-pulse flex items-center justify-center rounded-xl border border-theme text-muted text-sm"
      >
        Building interactive widget…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ minHeight: height, background: "#1a1d26" }}
        className="diagram-card my-4 flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400"
      >
        {error}
      </div>
    );
  }

  return (
    <div className="diagram-card my-4 overflow-hidden rounded-xl border border-theme shadow-sm">
      <iframe
        ref={iframeRef}
        title="Interactive widget"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
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
