"use client";

import { MessageSquare, LayoutGrid } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { EngineMode } from "@/types";

const MODES: { id: EngineMode; label: string; short: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", short: "Chat", icon: MessageSquare },
  { id: "canvas", label: "Canvas", short: "Canvas", icon: LayoutGrid },
];

interface EngineModeToggleProps {
  compact?: boolean;
  className?: string;
}

export function EngineModeToggle({ compact, className = "" }: EngineModeToggleProps) {
  const engineMode = useAppStore((s) => s.engineMode);
  const setEngineMode = useAppStore((s) => s.setEngineMode);

  return (
    <div
      className={[
        "engine-mode-toggle",
        compact ? "engine-mode-toggle--compact" : "",
        className,
      ].join(" ")}
      role="tablist"
      aria-label="Engine mode"
    >
      {MODES.map(({ id, label, short, icon: Icon }) => {
        const active = engineMode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            title={`${label} mode`}
            onClick={() => setEngineMode(id)}
            className={[
              "engine-mode-toggle-btn",
              active ? "engine-mode-toggle-btn--active" : "",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" strokeWidth={1.75} />
            <span>{compact ? short : label}</span>
          </button>
        );
      })}
    </div>
  );
}
