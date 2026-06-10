"use client";

import type { DiagramWidgetConfig } from "@/types/diagram";

interface GenericDataVisualizerProps {
  config: DiagramWidgetConfig;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatValue(v)).join(", ");
  }
  return JSON.stringify(value, null, 2);
}

function isObjectArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => v && typeof v === "object" && !Array.isArray(v))
  );
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = [
    ...new Set(rows.flatMap((row) => Object.keys(row))),
  ].slice(0, 8);

  return (
    <div className="overflow-x-auto rounded-lg border border-theme">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-theme bg-surface-muted/60">
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium text-muted">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-theme/60 last:border-0">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-primary align-top">
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GenericDataVisualizer({ config }: GenericDataVisualizerProps) {
  const entries = Object.entries(config.data);
  const tableKey = entries.find(([, v]) => isObjectArray(v))?.[0];
  const tableRows = tableKey ? (config.data[tableKey] as Record<string, unknown>[]) : null;

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-primary">
            {config.title ?? "Diagram"}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Type: {config.widget_type}
            {config.layout_hint ? ` · Layout: ${config.layout_hint}` : ""}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-1 rounded-full border border-theme text-muted">
          Generic view
        </span>
      </div>

      {tableRows ? (
        <DataTable rows={tableRows} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-theme bg-[#0f1117]/40 px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-wide text-muted mb-1">
                {key}
              </p>
              {typeof value === "object" && value !== null ? (
                <pre className="text-[11px] text-primary whitespace-pre-wrap font-mono leading-relaxed">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-primary">{formatValue(value)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-xs text-muted">No structured data in this diagram.</p>
      )}
    </div>
  );
}
