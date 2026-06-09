"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAppStore, PREFERRED_DEFAULT_MODEL } from "@/lib/store";
import { fetchModels } from "@/lib/ollama";
import type { OllamaModel } from "@/types";

function pickDefaultModel(models: OllamaModel[]): string | null {
  if (models.length === 0) return null;
  const preferred = models.find(
    (m) => m.name.toLowerCase() === PREFERRED_DEFAULT_MODEL.toLowerCase()
  );
  return preferred?.name ?? models[0].name;
}

export function useModels() {
  const {
    models,
    modelsLoading,
    modelsError,
    modelsResolvedHost,
    settings,
    setModels,
    setModelsLoading,
    setModelsError,
    setModelsResolvedHost,
    updateSettings,
  } = useAppStore();

  const applyDefaultIfNeeded = useCallback(
    (available: OllamaModel[]) => {
      const { settings } = useAppStore.getState();
      if (settings.defaultModel) return;
      const name = pickDefaultModel(available);
      if (name) updateSettings({ defaultModel: name });
    },
    [updateSettings]
  );

  const refreshSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchModels(settings.ollamaHost, settings.apiKey);
      if (seq !== refreshSeq.current) return;
      const list = Array.isArray(data.models) ? data.models : [];
      setModels(list);
      setModelsResolvedHost(data.resolvedHost ?? null);
      // Read fresh state after fetch — avoids overwriting a rehydrated default
      // when an earlier in-flight request started before hydration finished.
      applyDefaultIfNeeded(list);
    } catch (err: unknown) {
      if (seq !== refreshSeq.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setModelsError(msg);
    } finally {
      if (seq === refreshSeq.current) {
        setModelsLoading(false);
      }
    }
  }, [
    settings.ollamaHost,
    settings.apiKey,
    setModels,
    setModelsLoading,
    setModelsError,
    setModelsResolvedHost,
    applyDefaultIfNeeded,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      const { models } = useAppStore.getState();
      if (models.length > 0) applyDefaultIfNeeded(models);
    });
    return unsub;
  }, [applyDefaultIfNeeded]);

  return {
    models,
    loading: modelsLoading,
    error: modelsError,
    resolvedHost: modelsResolvedHost,
    refresh,
  };
}
