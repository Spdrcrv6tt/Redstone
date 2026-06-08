"use client";

import { useAppStore } from "@/lib/store";
import { useModels } from "@/hooks/useModels";
import { ChevronDown, Loader2, RefreshCw, KeyRound } from "lucide-react";
import { useState } from "react";
import { formatBytes } from "@/lib/utils";

interface ModelSelectorProps {
  conversationId?: string;
}

export function ModelSelector({ conversationId }: ModelSelectorProps) {
  const { models, loading, error, refresh } = useModels();
  const {
    conversations,
    settings,
    updateSettings,
    updateConversationModel,
    setSettingsOpen,
  } = useAppStore();
  const [open, setOpen] = useState(false);

  const conversation = conversations.find((c) => c.id === conversationId);
  const selectedModel = conversation?.model || settings.defaultModel;

  const handleSelect = (modelName: string) => {
    updateSettings({ defaultModel: modelName });
    if (conversationId) {
      updateConversationModel(conversationId, modelName);
    }
    setOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400 px-3 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Loading models…</span>
      </div>
    );
  }

  if (error) {
    const isAuthError =
      error.toLowerCase().includes("401") ||
      error.toLowerCase().includes("403") ||
      error.toLowerCase().includes("unauthorized");

    return (
      <div className="flex items-center gap-2 text-sm px-3 py-1.5">
        {isAuthError || !settings.apiKey ? (
          <>
            <KeyRound className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              Configure API key
            </button>
          </>
        ) : (
          <>
            <span className="text-red-400 truncate">Ollama unreachable</span>
            <button
              onClick={refresh}
              className="flex-shrink-0 p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-200"
              title="Retry"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-700/60 transition-colors max-w-[220px]"
      >
        <span className="truncate">{selectedModel || "Select model"}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 w-72 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider px-3 pt-3 pb-1">
              Available Models
            </div>
            <div className="max-h-64 overflow-y-auto">
              {models.length === 0 && (
                <p className="text-sm text-zinc-500 px-3 py-4 text-center">
                  No models found
                </p>
              )}
              {models.map((m) => (
                <button
                  key={m.name}
                  onClick={() => handleSelect(m.name)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-zinc-700/60 transition-colors flex items-start justify-between gap-2 ${
                    selectedModel === m.name ? "bg-zinc-700/40" : ""
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      {m.name}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {m.details?.parameter_size} · {m.details?.quantization_level}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 flex-shrink-0 mt-0.5">
                    {formatBytes(m.size)}
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-zinc-700 p-2">
              <button
                onClick={refresh}
                className="w-full flex items-center justify-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 py-1.5 rounded-lg hover:bg-zinc-700/40 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh models
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
