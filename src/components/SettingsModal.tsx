"use client";

import { useState, useEffect } from "react";
import { X, Server, Thermometer, MessageSquare, Save, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { AppSettings } from "@/types";

export function SettingsModal() {
  const { settings, settingsOpen, setSettingsOpen, updateSettings } = useAppStore();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (settingsOpen) setLocal(settings);
  }, [settingsOpen, settings]);

  if (!settingsOpen) return null;

  const save = () => {
    updateSettings(local);
    if (typeof window !== "undefined") {
      localStorage.setItem("ollama_host", local.ollamaHost);
    }
    setSettingsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Ollama Host */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2">
              <Server className="w-4 h-4" />
              Ollama Host
            </label>
            <input
              type="text"
              value={local.ollamaHost}
              onChange={(e) => setLocal((l) => ({ ...l, ollamaHost: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
              placeholder="http://localhost:11434"
            />
            <p className="text-xs text-zinc-500 mt-1">Base URL for your Ollama instance</p>
          </div>

          {/* API Key */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2">
              <KeyRound className="w-4 h-4" />
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={local.apiKey}
                onChange={(e) => setLocal((l) => ({ ...l, apiKey: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 pr-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
                placeholder="Leave blank if not required"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Sent as <span className="font-mono text-zinc-400">Authorization: Bearer &lt;key&gt;</span> — required for the Cloudflare tunnel
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2">
              <Thermometer className="w-4 h-4" />
              Temperature
              <span className="ml-auto text-zinc-400 font-mono text-xs">{local.temperature.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={local.temperature}
              onChange={(e) => setLocal((l) => ({ ...l, temperature: parseFloat(e.target.value) }))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2">
              <MessageSquare className="w-4 h-4" />
              System Prompt
            </label>
            <textarea
              value={local.systemPrompt}
              onChange={(e) => setLocal((l) => ({ ...l, systemPrompt: e.target.value }))}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
              placeholder="You are a helpful assistant…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-400 text-white rounded-xl transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
