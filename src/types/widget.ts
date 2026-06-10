export interface DynamicWidgetProps {
  height?: string;
  spec: string;
  /** Cached builder output — persisted in the message to avoid rebuild on refresh. */
  html?: string;
}

export interface WidgetArchitectSpec {
  component: "DynamicWidget";
  props: DynamicWidgetProps;
}
