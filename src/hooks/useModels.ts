"use client";

import { useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { fetchModels } from "@/lib/ollama";

export function useModels() {
  const { models, modelsLoading, modelsError, settings, setModels, setModelsLoading, setModelsError, updateSettings } =
    useAppStore();

  const refresh = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchModels(settings.ollamaHost);
      setModels(data.models);
      // Auto-set default model if none selected
      if (!settings.defaultModel && data.models.length > 0) {
        updateSettings({ defaultModel: data.models[0].name });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setModelsError(msg);
    } finally {
      setModelsLoading(false);
    }
  }, [settings.ollamaHost, settings.defaultModel, setModels, setModelsLoading, setModelsError, updateSettings]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, loading: modelsLoading, error: modelsError, refresh };
}
