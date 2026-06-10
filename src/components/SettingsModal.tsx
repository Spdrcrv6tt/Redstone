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
  LogOut,
  Layers,
} from "lucide-react";
import {
  DEFAULT_NUM_CTX,
  formatNumCtx,
  MAX_NUM_CTX,
  MIN_NUM_CTX,
  normalizeNumCtx,
  NUM_CTX_PRESETS,
} from "@/lib/context-window";
import { ModelPicker } from "@/components/ModelPicker";
import type { SearchMode, Theme, ThinkingOrbPath } from "@/types";
import { useAppStore } from "@/lib/store";
import type { AppSettings } from "@/types";
import {
  DEFAULT_THINKING_ORBS,
  ensureOrbColors,
  normalizeThinkingOrbs,
  THINKING_ORB_MAX,
  THINKING_ORB_MIN,
  THINKING_ORB_PATH_LABELS,
} from "@/lib/thinking-orbs";

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
        searchMode:
          settings.searchMode === "always" || settings.searchMode === "never"
            ? settings.searchMode
            : "auto",
        debugMode: settings.debugMode ?? false,
        thinkingOrbs: normalizeThinkingOrbs(
          settings.thinkingOrbs ?? DEFAULT_THINKING_ORBS
        ),
        numCtx: normalizeNumCtx(settings.numCtx),
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
    updateSettings({
      ...local,
      thinkingOrbs: normalizeThinkingOrbs(local.thinkingOrbs),
      numCtx: normalizeNumCtx(local.numCtx),
    });
    setSettingsOpen(false);
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSettingsOpen(false);
    window.location.href = "/login";
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
                  <Field label="Ollama host (tunnel / remote)" icon={Server}>
                    <input
                      type="text"
                      value={local.ollamaHost}
                      onChange={(e) =>
                        setLocal((l) => ({ ...l, ollamaHost: e.target.value }))
                      }
                      className="field-input font-mono text-[13px]"
                      placeholder="https://ollama.deoxylabs.com"
                      spellCheck={false}
                    />
                    <Hint>Used for remote access. Set to your Cloudflare tunnel URL.</Hint>
                  </Field>

                  <Field label="Local Ollama host (same machine)" icon={Server}>
                    <input
                      type="text"
                      value={local.localOllamaHost}
                      onChange={(e) =>
                        setLocal((l) => ({ ...l, localOllamaHost: e.target.value }))
                      }
                      className="field-input font-mono text-[13px]"
                      placeholder="http://127.0.0.1:11434"
                      spellCheck={false}
                    />
                    <Hint>The server queries this directly to get the full model list. Set to your Ollama port if models are missing.</Hint>
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
                      Auto uses heuristics to decide when to search. Always /
                      Never force search on or off.
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

                {local.debugMode ? (
                  <div className="mt-5 space-y-4 rounded-xl border border-theme bg-surface-muted/50 p-4">
                    <p className="text-sm font-medium text-primary">
                      Thinking orbs
                    </p>
                    <div>
                      <p className="text-sm font-medium text-primary mb-2">
                        Orb count
                      </p>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={THINKING_ORB_MIN}
                          max={THINKING_ORB_MAX}
                          step={1}
                          value={local.thinkingOrbs.count}
                          onChange={(e) => {
                            const count = Number.parseInt(e.target.value, 10);
                            setLocal((l) => ({
                              ...l,
                              thinkingOrbs: normalizeThinkingOrbs({
                                ...l.thinkingOrbs,
                                count,
                                colors: ensureOrbColors(
                                  l.thinkingOrbs.colors,
                                  count
                                ),
                              }),
                            }));
                          }}
                          className="range-track flex-1"
                        />
                        <span className="text-xs font-medium text-primary w-6 text-right">
                          {local.thinkingOrbs.count}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-primary mb-2">
                        Orbit speed
                      </p>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={0.4}
                          max={5}
                          step={0.1}
                          value={local.thinkingOrbs.speed}
                          onChange={(e) =>
                            setLocal((l) => ({
                              ...l,
                              thinkingOrbs: {
                                ...l.thinkingOrbs,
                                speed: Number.parseFloat(e.target.value),
                              },
                            }))
                          }
                          className="range-track flex-1"
                        />
                        <span className="text-xs font-medium text-primary w-10 text-right">
                          {local.thinkingOrbs.speed.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-primary mb-2">
                        Orbit radius
                      </p>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={4}
                          max={18}
                          step={1}
                          value={local.thinkingOrbs.radius}
                          onChange={(e) =>
                            setLocal((l) => ({
                              ...l,
                              thinkingOrbs: {
                                ...l.thinkingOrbs,
                                radius: Number.parseInt(e.target.value, 10),
                              },
                            }))
                          }
                          className="range-track flex-1"
                        />
                        <span className="text-xs font-medium text-primary w-8 text-right">
                          {local.thinkingOrbs.radius}px
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-primary mb-2">
                        Path
                      </p>
                      <div className="segmented-control">
                        {(
                          Object.entries(THINKING_ORB_PATH_LABELS) as [
                            ThinkingOrbPath,
                            string,
                          ][]
                        ).map(([path, label]) => (
                          <button
                            key={path}
                            type="button"
                            onClick={() =>
                              setLocal((l) => ({
                                ...l,
                                thinkingOrbs: { ...l.thinkingOrbs, path },
                              }))
                            }
                            className={[
                              "segmented-option",
                              local.thinkingOrbs.path === path
                                ? "segmented-option-active"
                                : "",
                            ].join(" ")}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-primary mb-2">
                        Orb colors
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {local.thinkingOrbs.colors
                          .slice(0, local.thinkingOrbs.count)
                          .map((color, i) => (
                            <label
                              key={i}
                              className="flex items-center gap-2 text-xs text-secondary"
                            >
                              <input
                                type="color"
                                value={color}
                                onChange={(e) => {
                                  const next = [...local.thinkingOrbs.colors];
                                  next[i] = e.target.value;
                                  setLocal((l) => ({
                                    ...l,
                                    thinkingOrbs: {
                                      ...l.thinkingOrbs,
                                      colors: next,
                                    },
                                  }));
                                }}
                                className="w-9 h-9 rounded-lg border border-theme cursor-pointer bg-transparent p-0.5"
                              />
                              #{i + 1}
                            </label>
                          ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setLocal((l) => ({
                          ...l,
                          thinkingOrbs: DEFAULT_THINKING_ORBS,
                        }))
                      }
                      className="text-xs text-muted hover:text-primary transition-colors"
                    >
                      Reset orbs to defaults
                    </button>
                  </div>
                ) : null}
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

                  <Field label="Context window" icon={Layers}>
                    <div className="segmented-control flex-wrap">
                      {NUM_CTX_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setLocal((l) => ({ ...l, numCtx: preset }))
                          }
                          className={[
                            "segmented-option",
                            local.numCtx === preset ? "segmented-option-active" : "",
                          ].join(" ")}
                        >
                          {formatNumCtx(preset)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="number"
                        min={MIN_NUM_CTX}
                        max={MAX_NUM_CTX}
                        step={1024}
                        value={local.numCtx}
                        onChange={(e) =>
                          setLocal((l) => ({
                            ...l,
                            numCtx: normalizeNumCtx(e.target.value),
                          }))
                        }
                        className="field-input w-32 tabular-nums"
                      />
                      <span className="text-xs text-muted">tokens</span>
                      {local.numCtx !== DEFAULT_NUM_CTX ? (
                        <button
                          type="button"
                          onClick={() =>
                            setLocal((l) => ({ ...l, numCtx: DEFAULT_NUM_CTX }))
                          }
                          className="text-xs text-muted hover:text-primary transition-colors ml-auto"
                        >
                          Reset to {formatNumCtx(DEFAULT_NUM_CTX)}
                        </button>
                      ) : null}
                    </div>
                    <Hint>
                      Passed to Ollama as <code className="text-[10px]">num_ctx</code>.
                      Higher values keep more chat history but use more VRAM.
                    </Hint>
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
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm btn-ghost rounded-xl text-secondary hover:text-primary"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                Sign out
              </button>
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
