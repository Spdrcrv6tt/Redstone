"use client";

import { useCallback, useRef } from "react";
import { useAppStore, PREFERRED_DEFAULT_MODEL } from "@/lib/store";
import { fetchModels } from "@/lib/ollama";
import type { OllamaModel } from "@/types";

let loadSeq = 0;

function pickDefaultModel(models: OllamaModel[]): string | null {
  if (models.length === 0) return null;
  const preferred = models.find(
    (m) => m.name.toLowerCase() === PREFERRED_DEFAULT_MODEL.toLowerCase()
  );
  return preferred?.name ?? models[0].name;
}

/** Shared loader — safe to call from bootstrap, settings save, or picker refresh. */
export async function loadModelsFromOllama() {
  const seq = ++loadSeq;
  const {
    settings,
    setModels,
    setModelsLoading,
    setModelsError,
    updateSettings,
  } = useAppStore.getState();

  setModelsLoading(true);
  setModelsError(null);

  try {
    const data = await fetchModels(settings.ollamaHost, settings.apiKey);
    if (seq !== loadSeq) return;

    const list = Array.isArray(data.models) ? data.models : [];
    setModels(list);

    const { settings: current } = useAppStore.getState();
    if (!current.defaultModel && list.length > 0) {
      const name = pickDefaultModel(list);
      if (name) updateSettings({ defaultModel: name });
    }
  } catch (err: unknown) {
    if (seq !== loadSeq) return;
    const msg = err instanceof Error ? err.message : String(err);
    setModelsError(msg);
  } finally {
    if (seq === loadSeq) {
      setModelsLoading(false);
    }
  }
}

export function useModels() {
  const models = useAppStore((s) => s.models);
  const modelsLoading = useAppStore((s) => s.modelsLoading);
  const modelsError = useAppStore((s) => s.modelsError);

  const refresh = useCallback(() => loadModelsFromOllama(), []);

  return { models, loading: modelsLoading, error: modelsError, refresh };
}

/** Call once after persisted settings hydrate — avoids racing with empty apiKey. */
export function useModelsBootstrap() {
  const ollamaHost = useAppStore((s) => s.settings.ollamaHost);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const booted = useRef(false);

  const run = useCallback(() => {
    void loadModelsFromOllama();
  }, []);

  const onHydrated = useCallback(() => {
    if (booted.current) return;
    booted.current = true;
    run();
  }, [run]);

  return { onHydrated, ollamaHost, apiKey, run, booted };
}
