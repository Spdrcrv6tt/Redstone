"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  PanelLeft,
  Settings,
  ChevronDown,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useModels } from "@/hooks/useModels";

interface TopBarProps {
  isChat: boolean;
}

export function TopBar({ isChat }: TopBarProps) {
  const { settings, updateSettings, sidebarOpen, setSidebarOpen, setSettingsOpen, activeConversationId, conversations, updateConversationModel } =
    useAppStore();
  const { models, loading, error, refresh } = useModels();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const currentModel = activeConv?.model || settings.defaultModel;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectModel = (name: string) => {
    updateSettings({ defaultModel: name });
    if (activeConversationId && activeConv) {
      updateConversationModel(activeConversationId, name);
    }
    setOpen(false);
  };

  return (
    <div
      className="flex-shrink-0 flex items-center gap-3 px-4 py-3 z-20"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Sidebar toggle (chat mode only) */}
      {isChat && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 transition-all duration-150"
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}

      {/* Brand (chat mode only — landing has the hero logo) */}
      {isChat && (
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{
              background: "rgba(249,115,22,0.15)",
              border: "1px solid rgba(249,115,22,0.2)",
            }}
          >
            <Flame className="w-3 h-3 text-orange-400" />
          </div>
          <span className="text-sm font-semibold text-zinc-300 tracking-tight">Redstone</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Model picker */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => { if (!open) refresh(); setOpen((v) => !v); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all duration-150"
          style={{
            background: open ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${open ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
            color: currentModel ? "#e4e4e7" : "#71717a",
          }}
          onMouseEnter={(e) => {
            if (!open) {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
            }
          }}
          onMouseLeave={(e) => {
            if (!open) {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
            }
          }}
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
            : error
              ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              : null}
          <span className="max-w-[160px] truncate">
            {currentModel || "Select model"}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[220px] max-h-72 overflow-y-auto rounded-2xl py-1.5"
              style={{
                background: "rgba(18,18,20,0.95)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)",
              }}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              {loading && (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading models…
                </div>
              )}
              {error && (
                <div className="px-4 py-2.5 text-xs text-amber-400">{error}</div>
              )}
              {!loading && !error && models.length === 0 && (
                <div className="px-4 py-2.5 text-xs text-zinc-500">No models found</div>
              )}
              {models.map((m) => (
                <button
                  key={m.name}
                  onClick={() => selectModel(m.name)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-zinc-300 transition-colors"
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <span className="truncate">{m.name}</span>
                  {m.name === currentModel && <Check className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 ml-2" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 transition-all duration-150"
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
}
