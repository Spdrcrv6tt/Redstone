"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { InlineEngineDiagramConfig } from "@/types/diagram";

const PHASE_COLORS = ["#3b82f6", "#f59e0b", "#ef4444", "#94a3b8"];
const DEFAULT_LABELS = ["Intake", "Compression", "Power", "Exhaust"];

function pistonOffset(phase: number): string {
  switch (phase % 4) {
    case 0:
      return "72%";
    case 1:
      return "18%";
    case 2:
      return "72%";
    default:
      return "18%";
  }
}

interface EngineVisualizerProps {
  config: InlineEngineDiagramConfig;
}

export function EngineVisualizer({ config }: EngineVisualizerProps) {
  const labels = config.labels ?? DEFAULT_LABELS;
  const firingOrder = config.firingOrder;
  const cylinderCount = config.cylinders ?? firingOrder.length;

  const [orderIdx, setOrderIdx] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const activeCylinder = firingOrder[orderIdx] ?? 1;

  const phaseForCylinder = useCallback(
    (cylinder: number): number => {
      const j = firingOrder.indexOf(cylinder);
      const i = orderIdx;
      if (j < 0) return 0;
      return (phaseIdx - (j - i) + labels.length * 8) % labels.length;
    },
    [firingOrder, labels.length, orderIdx, phaseIdx]
  );

  const stepForward = useCallback(() => {
    setPhaseIdx((p) => {
      if (p < labels.length - 1) return p + 1;
      setOrderIdx((i) => (i + 1) % firingOrder.length);
      return 0;
    });
  }, [firingOrder.length, labels.length]);

  const stepBack = useCallback(() => {
    setPhaseIdx((p) => {
      if (p > 0) return p - 1;
      setOrderIdx((i) => (i - 1 + firingOrder.length) % firingOrder.length);
      return labels.length - 1;
    });
  }, [firingOrder.length, labels.length]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(stepForward, 1400);
    return () => window.clearInterval(id);
  }, [playing, stepForward]);

  const cylinders = useMemo(
    () => Array.from({ length: cylinderCount }, (_, i) => i + 1),
    [cylinderCount]
  );

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-primary">
            {config.title ?? "Inline Engine"}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Firing order: {firingOrder.join("-")} · Step{" "}
            {orderIdx * labels.length + phaseIdx + 1}/
            {firingOrder.length * labels.length}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={stepBack}
            className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors"
            title="Previous stroke"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={stepForward}
            className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors"
            title="Next stroke"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {cylinders.map((num) => {
          const phase = phaseForCylinder(num);
          const isActive = num === activeCylinder;
          const color = PHASE_COLORS[phase] ?? PHASE_COLORS[0];

          return (
            <div
              key={num}
              className={`rounded-xl border p-2 transition-colors ${
                isActive
                  ? "border-indigo-500/60 bg-indigo-500/5 ring-1 ring-indigo-500/30"
                  : "border-theme bg-[#0f1117]/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                  Cyl {num}
                </span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    color,
                    backgroundColor: `${color}22`,
                  }}
                >
                  {labels[phase]}
                </span>
              </div>
              <div
                className="relative mx-auto h-36 w-full max-w-[88px] rounded-lg overflow-hidden"
                style={{ background: "linear-gradient(180deg, #1a1d27 0%, #0f1117 100%)" }}
              >
                <div
                  className="absolute left-1 right-1 top-2 h-8 rounded-sm opacity-80"
                  style={{ backgroundColor: `${color}33`, border: `1px solid ${color}55` }}
                />
                <motion.div
                  className="absolute left-1.5 right-1.5 h-7 rounded-sm"
                  style={{
                    background: "linear-gradient(180deg, #cbd5e1 0%, #64748b 100%)",
                    boxShadow: isActive ? `0 0 12px ${color}66` : undefined,
                  }}
                  animate={{ top: pistonOffset(phase) }}
                  transition={{ type: "spring", stiffness: 120, damping: 18 }}
                />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-zinc-600 border border-zinc-500" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setPhaseIdx(i)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              phaseIdx === i && firingOrder[orderIdx] === activeCylinder
                ? "border-indigo-500/50 text-primary bg-indigo-500/10"
                : "border-theme text-muted hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {config.notes && (
        <p className="text-xs text-muted leading-relaxed border-t border-theme pt-3">
          {config.notes}
        </p>
      )}
    </div>
  );
}
