import type { DiagramConfig, InlineEngineDiagramConfig } from "@/types/diagram";

export type ParsedDiagram =
  | { kind: "config"; config: DiagramConfig }
  | { kind: "html"; html: string }
  | { kind: "invalid"; raw: string; error: string };

const DEFAULT_ENGINE_LABELS = ["Intake", "Compression", "Power", "Exhaust"];

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
  attempt = attempt.replace(/:\s*$/, ': null');

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

function normalizeEngineConfig(raw: InlineEngineDiagramConfig): InlineEngineDiagramConfig {
  const cylinders = raw.cylinders ?? raw.firingOrder.length;
  const firingOrder =
    raw.firingOrder.length > 0
      ? raw.firingOrder
      : Array.from({ length: cylinders }, (_, i) => i + 1);

  return {
    type: "inline-engine",
    cylinders,
    firingOrder,
    labels:
      raw.labels?.length === 4
        ? raw.labels
        : DEFAULT_ENGINE_LABELS.slice(0, 4),
    notes: raw.notes,
    title: raw.title,
  };
}

function validateConfig(value: unknown): DiagramConfig | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (record.type === "inline-engine") {
    const firingOrder = Array.isArray(record.firingOrder)
      ? record.firingOrder.filter((n): n is number => typeof n === "number")
      : [];
    if (!firingOrder.length) return null;

    return normalizeEngineConfig({
      type: "inline-engine",
      cylinders:
        typeof record.cylinders === "number" ? record.cylinders : undefined,
      firingOrder,
      labels: Array.isArray(record.labels)
        ? record.labels.filter((l): l is string => typeof l === "string")
        : undefined,
      notes: typeof record.notes === "string" ? record.notes : undefined,
      title: typeof record.title === "string" ? record.title : undefined,
    });
  }

  return null;
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
      const config = validateConfig(parsed);
      if (config) return { kind: "config", config };
    } catch {
      const repaired = repairTruncatedJson(trimmed);
      const config = repaired ? validateConfig(repaired) : null;
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
