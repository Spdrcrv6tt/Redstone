export interface DynamicWidgetProps {
  height?: string;
  spec: string;
}

export interface WidgetArchitectSpec {
  component: "DynamicWidget";
  props: DynamicWidgetProps;
}
