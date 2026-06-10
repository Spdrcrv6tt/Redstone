"use client";

import { useState } from "react";
import { GenericDataVisualizer } from "@/components/diagrams/GenericDataVisualizer";
import type { DiagramWidgetConfig, TimelineEvent } from "@/types/diagram";

interface TimelineVisualizerProps {
  config: DiagramWidgetConfig;
}

function extractEvents(data: Record<string, unknown>): TimelineEvent[] {
  const raw =
    data.events ?? data.steps ?? data.items ?? data.timeline ?? data.phases;

  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        time:
          (typeof row.time === "string" && row.time) ||
          (typeof row.timestamp === "string" && row.timestamp) ||
          (typeof row.date === "string" && row.date) ||
          undefined,
        label:
          (typeof row.label === "string" && row.label) ||
          (typeof row.title === "string" && row.title) ||
          (typeof row.name === "string" && row.name) ||
          undefined,
        description:
          (typeof row.description === "string" && row.description) ||
          (typeof row.detail === "string" && row.detail) ||
          (typeof row.summary === "string" && row.summary) ||
          undefined,
      };
    });
}

export function TimelineVisualizer({ config }: TimelineVisualizerProps) {
  const events = extractEvents(config.data);
  const [active, setActive] = useState(0);

  if (!events.length) {
    return <GenericDataVisualizer config={config} />;
  }

  const layout = config.layout_hint ?? "linear";

  return (
    <div className="p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-primary mb-1">
        {config.title ?? "Timeline"}
      </h3>
      <p className="text-xs text-muted mb-4">{events.length} events</p>

      <div
        className={
          layout === "grid"
            ? "grid gap-2 sm:grid-cols-2"
            : "space-y-2"
        }
      >
        {events.map((event, index) => {
          const isActive = index === active;
          return (
            <button
              key={`${event.time ?? "t"}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                isActive
                  ? "border-indigo-500/50 bg-indigo-500/10"
                  : "border-theme bg-[#0f1117]/40 hover:border-indigo-500/30"
              }`}
            >
              {event.time && (
                <p className="text-[10px] font-mono text-indigo-400 mb-0.5">
                  {event.time}
                </p>
              )}
              <p className="text-sm font-medium text-primary">
                {event.label ?? `Event ${index + 1}`}
              </p>
              {event.description && (
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {event.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
