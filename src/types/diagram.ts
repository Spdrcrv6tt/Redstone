export type LayoutHint = "radial" | "linear" | "grid";

/** Flexible diagram payload from the model. */
export interface DiagramWidgetConfig {
  widget_type: string;
  title?: string;
  data: Record<string, unknown>;
  layout_hint?: LayoutHint;
}

/** Engine widget `data` shape (widget_type: engine-diagram). */
export interface EngineDiagramData {
  cylinders?: number;
  firingOrder?: number[];
  firing_order?: number[];
  labels?: string[];
  notes?: string;
}

export interface TimelineEvent {
  time?: string;
  label?: string;
  title?: string;
  description?: string;
}
