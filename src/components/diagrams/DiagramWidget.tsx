"use client";

import { useMemo } from "react";
import { DiagramWidgetRouter } from "@/components/diagrams/DiagramWidgetRouter";
import { LegacyHtmlDiagram } from "@/components/diagrams/LegacyHtmlDiagram";
import { parseDiagramPayload } from "@/lib/diagram-config";

interface DiagramWidgetProps {
  payload: string;
  className?: string;
}

export function DiagramWidget({ payload, className = "" }: DiagramWidgetProps) {
  const parsed = useMemo(() => parseDiagramPayload(payload), [payload]);

  if (parsed.kind === "config") {
    return (
      <div
        className={`diagram-card my-4 overflow-hidden rounded-2xl border border-theme bg-[#0f1117] shadow-sm ${className}`}
      >
        <DiagramWidgetRouter config={parsed.config} />
      </div>
    );
  }

  if (parsed.kind === "html") {
    return <LegacyHtmlDiagram htmlContent={parsed.html} className={className} />;
  }

  if (parsed.kind === "invalid") {
    return (
      <div
        className={`diagram-card my-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 ${className}`}
      >
        <p className="text-sm text-red-400">Failed to parse diagram data.</p>
        <p className="text-xs text-muted mt-1">{parsed.error}</p>
      </div>
    );
  }

  return null;
}

export function DiagramPending() {
  return (
    <div className="diagram-card my-4 flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-theme bg-surface-muted/60">
      <p className="text-sm text-muted">Building diagram…</p>
    </div>
  );
}
