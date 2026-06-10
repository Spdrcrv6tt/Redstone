/** JSON payload rendered by native React diagram components. */
export interface InlineEngineDiagramConfig {
  type: "inline-engine";
  cylinders?: number;
  firingOrder: number[];
  labels?: string[];
  notes?: string;
  title?: string;
}

export type DiagramConfig = InlineEngineDiagramConfig;
