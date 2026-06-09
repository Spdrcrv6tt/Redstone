"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Search,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useModels } from "@/hooks/useModels";
import { formatModelLabel, formatBytes } from "@/lib/utils";
import type { OllamaModel } from "@/types";

interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
  /** compact = composer pill; panel = settings list */
  variant?: "compact" | "panel";
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** Allow typing a model name not in the Ollama list */
  allowManualEntry?: boolean;
}

export function ModelPicker({
  value,
  onChange,
  variant = "compact",
  className,
  allowEmpty = false,
  emptyLabel = "None",
  allowManualEntry = false,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [manual, setManual] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 300, above: true });
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { setSettingsOpen } = useAppStore();
  const { models, loading, error, refresh } = useModels();

  useEffect(() => {
    setManual(value);
  }, [value]);

  const valueInList = useMemo(
    () => models.some((m) => m.name === value),
    [models, value]
  );

  const filteredModels = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.name.toLowerCase().includes(q));
  }, [models, filter]);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(280, Math.min(360, rect.width + 120));
    const left = Math.min(
      Math.max(12, rect.right - width),
      window.innerWidth - width - 12
    );
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceAbove > spaceBelow && spaceAbove > 160;
    const top = above ? rect.top - 8 : rect.bottom + 8;
    setPos({ top, left, width, above });
  }, []);

  useEffect(() => {
    if (!open || variant !== "compact") return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, variant, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (anchorRef.current?.contains(e.target as Node)) return;
      const portal = document.getElementById("model-picker-portal");
      if (portal?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const openPicker = () => {
    if (!open) refresh();
    setOpen((v) => !v);
  };

  const select = (name: string) => {
    onChange(name);
    setManual(name);
    setOpen(false);
  };

  const renderModelRow = (m: OllamaModel) => (
    <button
      key={m.name}
      type="button"
      onClick={() => select(m.name)}
      className={[
        "w-full flex items-start gap-3 px-3 py-2.5 mx-1 rounded-lg text-left transition-colors",
        m.name === value ? "bg-accent-muted" : "hover:bg-surface-hover",
      ].join(" ")}
    >
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm truncate ${m.name === value ? "text-primary font-medium" : "text-primary"}`}
        >
          {m.name}
        </p>
        {m.details?.parameter_size && (
          <p className="text-[11px] text-muted mt-0.5">
            {m.details.parameter_size} · {formatBytes(m.size)}
          </p>
        )}
      </div>
      {m.name === value && (
        <Check
          className="w-4 h-4 flex-shrink-0 mt-0.5"
          style={{ color: "var(--accent)" }}
        />
      )}
    </button>
  );

  const listContent = (
    <>
      {loading && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading models…
        </div>
      )}
      {error && (
        <div className="px-4 py-3 border-b border-theme">
          <p className="text-xs text-amber-600 leading-relaxed mb-2">{error}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => refresh()}
              className="text-xs text-primary font-medium hover:underline"
            >
              Retry
            </button>
            {(error.includes("401") ||
              error.includes("403") ||
              error.toLowerCase().includes("unauthorized")) && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
                className="text-xs text-indigo-500 font-medium hover:underline"
              >
                Settings
              </button>
            )}
          </div>
        </div>
      )}

      {models.length > 4 && (
        <div className="px-3 py-2 border-b border-theme">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] text-muted">
              {loading
                ? "Loading…"
                : `${models.length} model${models.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter models…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-theme bg-surface-muted text-primary"
            />
          </div>
        </div>
      )}

      {!loading && models.length === 0 && !error && !allowEmpty && (
        <p className="px-4 py-3 text-xs text-muted">No models found</p>
      )}

      {allowEmpty && (
        <button
          type="button"
          onClick={() => select("")}
          className={[
            "w-full flex items-start gap-3 px-3 py-2.5 mx-1 rounded-lg text-left transition-colors",
            !value ? "bg-accent-muted" : "hover:bg-surface-hover",
          ].join(" ")}
        >
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm ${!value ? "text-primary font-medium" : "text-muted"}`}
            >
              {emptyLabel}
            </p>
          </div>
          {!value && (
            <Check
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: "var(--accent)" }}
            />
          )}
        </button>
      )}

      {value && !valueInList && (
        <button
          type="button"
          onClick={() => select(value)}
          className="w-full flex items-start gap-3 px-3 py-2.5 mx-1 rounded-lg text-left bg-accent-muted"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm text-primary font-medium truncate">{value}</p>
            <p className="text-[11px] text-muted mt-0.5">Custom / not in list</p>
          </div>
          <Check
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            style={{ color: "var(--accent)" }}
          />
        </button>
      )}

      {filteredModels.map(renderModelRow)}

      {filter && filteredModels.length === 0 && models.length > 0 && (
        <p className="px-4 py-3 text-xs text-muted">No models match &ldquo;{filter}&rdquo;</p>
      )}
    </>
  );

  if (variant === "panel") {
    return (
      <div className={className}>
        <div className="flex items-center justify-between gap-3 mb-2.5 px-3 py-2 rounded-xl border border-theme bg-surface-muted">
          <span className="text-[13px] text-primary font-medium truncate">
            {value || (allowEmpty ? emptyLabel : "No model selected")}
          </span>
          <button
            type="button"
            onClick={() => refresh()}
            className="p-1.5 rounded-lg text-muted hover:text-primary btn-ghost flex-shrink-0"
            title="Refresh models"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        <div className="rounded-xl border border-theme bg-surface max-h-80 overflow-y-auto py-1">
          {listContent}
        </div>
        {allowManualEntry && (
          <div className="mt-2.5">
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onBlur={() => {
                if (manual.trim() && manual.trim() !== value) {
                  onChange(manual.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manual.trim()) {
                  onChange(manual.trim());
                }
              }}
              placeholder="Or type model name (e.g. gemma4:2b)"
              className="field-input font-mono text-[13px]"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    );
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dropdown =
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            id="model-picker-portal"
            key="model-picker-dropdown"
            className="fixed z-[200] rounded-2xl bg-surface border border-theme shadow-[0_12px_40px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
            style={{
              width: pos.width,
              left: pos.left,
              ...(pos.above
                ? { bottom: window.innerHeight - pos.top }
                : { top: pos.top }),
              maxHeight: Math.min(420, window.innerHeight * 0.55),
            }}
            initial={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            <div className="overflow-y-auto flex-1 py-1">{listContent}</div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={openPicker}
        className={[
          "flex items-center gap-1 px-3 py-2 md:px-2.5 md:py-1.5 rounded-full text-sm md:text-xs font-medium text-secondary min-h-[44px] md:min-h-0",
          "hover:bg-surface-muted hover:text-primary transition-colors border border-transparent hover:border-theme",
          className ?? "",
        ].join(" ")}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : error ? (
          <AlertTriangle className="w-3 h-3 text-amber-500" />
        ) : null}
        <span className="truncate max-w-[9rem] md:max-w-none">
          {value ? formatModelLabel(value) : "Model"}
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {dropdown}
    </>
  );
}
