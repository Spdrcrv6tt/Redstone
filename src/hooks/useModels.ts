"use client";

import { useEffect, useCallback } from "react";
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
    settings,
    setModels,
    setModelsLoading,
    setModelsError,
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

  const refresh = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchModels(settings.ollamaHost, settings.apiKey);
      setModels(data.models);
      // Read fresh state after fetch — avoids overwriting a rehydrated default
      // when an earlier in-flight request started before hydration finished.
      applyDefaultIfNeeded(data.models);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setModelsError(msg);
    } finally {
      setModelsLoading(false);
    }
  }, [
    settings.ollamaHost,
    settings.apiKey,
    setModels,
    setModelsLoading,
    setModelsError,
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

  return { models, loading: modelsLoading, error: modelsError, refresh };
}
