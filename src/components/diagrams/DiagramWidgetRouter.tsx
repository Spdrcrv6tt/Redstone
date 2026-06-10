"use client";

import { EngineVisualizer } from "@/components/diagrams/EngineVisualizer";
import { GenericDataVisualizer } from "@/components/diagrams/GenericDataVisualizer";
import { TimelineVisualizer } from "@/components/diagrams/TimelineVisualizer";
import { asEngineData, normalizeWidgetType } from "@/lib/diagram-config";
import type { DiagramWidgetConfig } from "@/types/diagram";

interface DiagramWidgetRouterProps {
  config: DiagramWidgetConfig;
}

export function DiagramWidgetRouter({ config }: DiagramWidgetRouterProps) {
  const widgetType = normalizeWidgetType(config.widget_type);

  switch (widgetType) {
    case "engine-diagram": {
      const engineData = asEngineData(config.data);
      if (engineData) {
        return (
          <EngineVisualizer data={engineData} title={config.title} />
        );
      }
      return <GenericDataVisualizer config={config} />;
    }
    case "timeline":
      return <TimelineVisualizer config={config} />;
    default:
      return <GenericDataVisualizer config={config} />;
  }
}
