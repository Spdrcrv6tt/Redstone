import type { DiagramWidgetConfig, EngineDiagramData, LayoutHint } from "@/types/diagram";

export type ParsedDiagram =
  | { kind: "config"; config: DiagramWidgetConfig }
  | { kind: "html"; html: string }
  | { kind: "invalid"; raw: string; error: string };

const LAYOUT_HINTS = new Set<LayoutHint>(["radial", "linear", "grid"]);

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/** Best-effort repair for truncated JSON from token-limited models. */
function repairTruncatedJson(text: string): unknown | null {
  let attempt = text.trim();
  attempt = attempt.replace(/,\s*([}\]])/g, "$1");
  attempt = attempt.replace(/,\s*$/, "");
  attempt = attempt.replace(/"[^"]*$/, '"');
  attempt = attempt.replace(/:\s*$/, ": null");

  const openBraces = (attempt.match(/{/g) || []).length;
  const closeBraces = (attempt.match(/}/g) || []).length;
  const openBrackets = (attempt.match(/\[/g) || []).length;
  const closeBrackets = (attempt.match(/]/g) || []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) attempt += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) attempt += "}";

  try {
    return JSON.parse(attempt);
  } catch {
    return null;
  }
}

function parseLayoutHint(value: unknown): LayoutHint | undefined {
  if (typeof value !== "string") return undefined;
  const hint = value.trim().toLowerCase() as LayoutHint;
  return LAYOUT_HINTS.has(hint) ? hint : undefined;
}

function asDataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Normalize legacy and dynamic diagram JSON into a single widget config. */
export function normalizeDiagramConfig(value: unknown): DiagramWidgetConfig | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (record.type === "inline-engine") {
    const { type: _t, title, ...rest } = record;
    return {
      widget_type: "engine-diagram",
      title: typeof title === "string" ? title : undefined,
      data: rest,
    };
  }

  const widgetTypeRaw =
    (typeof record.widget_type === "string" ? record.widget_type : undefined) ??
    (typeof record.widgetType === "string" ? record.widgetType : undefined) ??
    (typeof record.type === "string" ? record.type : undefined);

  if (!widgetTypeRaw?.trim()) return null;

  let data = asDataRecord(record.data);

  if (!Object.keys(data).length) {
    const {
      widget_type: _w,
      widgetType: _wt,
      type: _ty,
      title: _ti,
      layout_hint: _lh,
      layoutHint: _lhi,
      data: _d,
      ...rest
    } = record;
    if (Object.keys(rest).length) data = rest;
  }

  return {
    widget_type: widgetTypeRaw.trim(),
    title: typeof record.title === "string" ? record.title : undefined,
    data,
    layout_hint:
      parseLayoutHint(record.layout_hint) ?? parseLayoutHint(record.layoutHint),
  };
}

export function normalizeWidgetType(widgetType: string): string {
  const lower = widgetType.trim().toLowerCase();
  if (
    lower === "inline-engine" ||
    lower === "engine" ||
    lower === "four-stroke-engine"
  ) {
    return "engine-diagram";
  }
  return lower;
}

export function asEngineData(data: Record<string, unknown>): EngineDiagramData | null {
  const firingOrder = Array.isArray(data.firingOrder)
    ? data.firingOrder.filter((n): n is number => typeof n === "number")
    : Array.isArray(data.firing_order)
      ? data.firing_order.filter((n): n is number => typeof n === "number")
      : [];

  if (!firingOrder.length) return null;

  return {
    cylinders: typeof data.cylinders === "number" ? data.cylinders : undefined,
    firingOrder,
    labels: Array.isArray(data.labels)
      ? data.labels.filter((l): l is string => typeof l === "string")
      : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
  };
}

/** Parse diagram payload — prefers JSON config, falls back to legacy HTML. */
export function parseDiagramPayload(raw: string): ParsedDiagram {
  const trimmed = stripJsonFences(raw.trim());
  if (!trimmed) {
    return { kind: "invalid", raw, error: "Empty diagram payload" };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const config = normalizeDiagramConfig(parsed);
      if (config) return { kind: "config", config };
    } catch {
      const repaired = repairTruncatedJson(trimmed);
      const config = repaired ? normalizeDiagramConfig(repaired) : null;
      if (config) return { kind: "config", config };
    }
    return {
      kind: "invalid",
      raw: trimmed,
      error: "Could not parse diagram JSON",
    };
  }

  if (/<!DOCTYPE|<html/i.test(trimmed)) {
    return { kind: "html", html: trimmed };
  }

  return {
    kind: "invalid",
    raw: trimmed,
    error: "Diagram payload must be JSON configuration",
  };
}
