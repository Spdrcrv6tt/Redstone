"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Server,
  Thermometer,
  MessageSquare,
  KeyRound,
  Eye,
  EyeOff,
  User,
  Sun,
  Moon,
  Cpu,
  Globe,
  Bug,
  Route,
} from "lucide-react";
import { ModelPicker } from "@/components/ModelPicker";
import type { SearchMode, Theme } from "@/types";
import { useAppStore } from "@/lib/store";
import type { AppSettings } from "@/types";

export function SettingsModal() {
  const { settings, settingsOpen, theme, setSettingsOpen, updateSettings, setTheme } =
    useAppStore();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [showBraveKey, setShowBraveKey] = useState(false);

  useEffect(() => {
    if (settingsOpen) {
      setLocal({
        ...settings,
        displayName: settings.displayName ?? "",
        braveApiKey: settings.braveApiKey ?? "",
        routerModel: settings.routerModel ?? "",
        searchMode: settings.searchMode ?? "auto",
        debugMode: settings.debugMode ?? false,
      });
    }
  }, [settingsOpen, settings]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [settingsOpen, setSettingsOpen]);

  const save = () => {
    updateSettings(local);
    setSettingsOpen(false);
  };

  const tempLabel =
    local.temperature <= 0.4
      ? "Precise"
      : local.temperature <= 1.0
        ? "Balanced"
        : "Creative";

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-[6px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSettingsOpen(false)}
        >
          <motion.div
            className="modal-panel rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[min(88vh,720px)]"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-theme flex-shrink-0">
              <div>
                <h2 id="settings-title" className="text-[15px] font-semibold text-primary tracking-tight">
                  Settings
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Appearance, models, and connection
                </p>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-2 -mr-1 -mt-0.5 rounded-xl btn-ghost text-muted"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">
              {!local.apiKey && (
                <div className="alert-banner flex items-start gap-3 rounded-xl px-4 py-3">
                  <KeyRound className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-80" />
                  <p className="text-xs leading-relaxed">
                    An API key is required to connect through the Cloudflare tunnel.
                  </p>
                </div>
              )}

              <section>
                <p className="settings-section-title">Appearance</p>
                <div className="segmented-control">
                  {(["light", "dark"] as Theme[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={[
                        "segmented-option",
                        theme === t ? "segmented-option-active" : "",
                      ].join(" ")}
                    >
                      {t === "light" ? (
                        <Sun className="w-3.5 h-3.5" />
                      ) : (
                        <Moon className="w-3.5 h-3.5" />
                      )}
                      {t === "light" ? "Light" : "Dark"}
                    </button>
                  ))}
                </div>
              </section>

              <div className="settings-divider" />

              <section>
                <p className="settings-section-title">Personalization</p>
                <Field label="Display name" icon={User}>
                  <input
                    type="text"
                    value={local.displayName}
                    onChange={(e) =>
                      setLocal((l) => ({ ...l, displayName: e.target.value }))
                    }
                    className="field-input"
                    placeholder="Your name (optional)"
                  />
                  <Hint>Shown in the greeting on the home screen</Hint>
                </Field>
              </section>

              <div className="settings-divider" />

              <section>
                <p className="settings-section-title">Model</p>
                <Field label="Default model" icon={Cpu}>
                  <ModelPicker
                    variant="panel"
                    value={local.defaultModel}
                    onChange={(name) =>
                      setLocal((l) => ({ ...l, defaultModel: name }))
                    }
                  />
                  <Hint>Used for new chats. Override per conversation in the composer.</Hint>
                </Field>
              </section>

              <div className="settings-divider" />

              <section>
                <p className="settings-section-title">Connection</p>
                <div className="space-y-4">
                  <Field label="Ollama host" icon={Server}>
                    <input
                      type="text"
                      value={local.ollamaHost}
                      onChange={(e) =>
                        setLocal((l) => ({ ...l, ollamaHost: e.target.value }))
                      }
                      className="field-input font-mono text-[13px]"
                      placeholder="http://localhost:11434"
                      spellCheck={false}
                    />
                    <Hint>
                      On the Windows server, Redstone auto-detects local Ollama at
                      127.0.0.1:11434 even when this shows the tunnel URL.
                    </Hint>
                  </Field>

                  <Field label="Ollama API key" icon={KeyRound}>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        value={local.apiKey}
                        onChange={(e) =>
                          setLocal((l) => ({ ...l, apiKey: e.target.value }))
                        }
                        className="field-input pr-10 font-mono text-[13px]"
                        placeholder="Leave blank if not required"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-secondary btn-ghost"
                        tabIndex={-1}
                        aria-label={showKey ? "Hide API key" : "Show API key"}
                      >
                        {showKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </Field>

                  <Field label="Brave Search API key" icon={Globe}>
                    <div className="relative">
                      <input
                        type={showBraveKey ? "text" : "password"}
                        value={local.braveApiKey}
                        onChange={(e) =>
                          setLocal((l) => ({ ...l, braveApiKey: e.target.value }))
                        }
                        className="field-input pr-10 font-mono text-[13px]"
                        placeholder="For automatic web search on every message"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => setShowBraveKey((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-secondary btn-ghost"
                        tabIndex={-1}
                        aria-label={
                          showBraveKey ? "Hide Brave API key" : "Show Brave API key"
                        }
                      >
                        {showBraveKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <Hint>
                      Required for web search when enabled. Can also be set via
                      BRAVE_SEARCH_API_KEY on the server.
                    </Hint>
                  </Field>
                </div>
              </section>

              <div className="settings-divider" />

              <section>
                <p className="settings-section-title">Web search</p>
                <div className="space-y-4">
                  <Field label="Search mode" icon={Globe}>
                    <div className="segmented-control segmented-control-grid">
                      {(
                        [
                          ["auto", "Auto"],
                          ["aggressive", "Aggressive"],
                          ["always", "Always"],
                          ["never", "Never"],
                        ] as const
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() =>
                            setLocal((l) => ({
                              ...l,
                              searchMode: mode as SearchMode,
                            }))
                          }
                          className={[
                            "segmented-option",
                            local.searchMode === mode
                              ? "segmented-option-active"
                              : "",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <Hint>
                      Auto uses fast heuristics. Aggressive runs the orchestrator
                      model on every turn to plan web search and images. Always /
                      Never force search on or off.
                    </Hint>
                  </Field>

                  <Field
                    label={
                      local.searchMode === "aggressive"
                        ? "Orchestrator model"
                        : "Router model (optional)"
                    }
                    icon={Route}
                  >
                    <ModelPicker
                      variant="panel"
                      value={local.routerModel}
                      onChange={(name) =>
                        setLocal((l) => ({ ...l, routerModel: name }))
                      }
                      allowEmpty={local.searchMode !== "aggressive"}
                      emptyLabel={
                        local.searchMode === "aggressive"
                          ? "Required for aggressive mode"
                          : "None — heuristics only"
                      }
                      allowManualEntry
                    />
                    <Hint>
                      {local.searchMode === "aggressive"
                        ? "Small fast model (e.g. gemma4:2b) plans web search, images, and tools before the main model runs."
                        : "Consulted when Auto mode is uncertain. Pick any installed model or type a name."}
                    </Hint>
                  </Field>
                </div>
              </section>

              <div className="settings-divider" />

              <section>
                <p className="settings-section-title">Developer</p>
                <Field label="Debug mode" icon={Bug}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={local.debugMode}
                      onChange={(e) =>
                        setLocal((l) => ({
                          ...l,
                          debugMode: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-theme accent-indigo-500"
                    />
                    <span className="text-sm text-secondary">
                      Show raw model I/O and search decisions per message
                    </span>
                  </label>
                </Field>
              </section>

              <div className="settings-divider" />

              <section>
                <p className="settings-section-title">Generation</p>
                <div className="space-y-4">
                  <Field label="Temperature" icon={Thermometer}>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.1}
                        value={local.temperature}
                        onChange={(e) =>
                          setLocal((l) => ({
                            ...l,
                            temperature: parseFloat(e.target.value),
                          }))
                        }
                        className="range-track flex-1"
                      />
                      <div className="text-right flex-shrink-0 w-16">
                        <p className="text-xs font-medium text-primary">
                          {local.temperature.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-muted">{tempLabel}</p>
                      </div>
                    </div>
                  </Field>

                  <Field label="System prompt" icon={MessageSquare}>
                    <textarea
                      value={local.systemPrompt}
                      onChange={(e) =>
                        setLocal((l) => ({ ...l, systemPrompt: e.target.value }))
                      }
                      rows={4}
                      className="field-input resize-none leading-relaxed"
                      placeholder="You are a helpful assistant…"
                    />
                    <Hint>
                      Optional extra instructions. Web search context is added when
                      search runs — you don&apos;t need to ask the model to search.
                    </Hint>
                  </Field>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-theme flex-shrink-0 bg-surface-muted/40">
              <p className="text-[11px] text-muted hidden sm:block">
                Changes apply after saving
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 text-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  className="px-5 py-2 text-sm font-medium btn-send rounded-xl"
                >
                  Save changes
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
        <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={1.75} />
        {label}
      </label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted mt-1.5 leading-relaxed">{children}</p>;
}
