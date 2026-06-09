"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useModelsBootstrap } from "@/hooks/useModels";

/** Hydrate store, apply theme, and open settings on first run if needed. */
export function AppBootstrap() {
  const theme = useAppStore((s) => s.theme);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const checked = useRef(false);
  const { onHydrated, ollamaHost, apiKey, run, booted } = useModelsBootstrap();

  useEffect(() => {
    useAppStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      if (checked.current) return;
      checked.current = true;
      onHydrated();
      if (!useAppStore.getState().settings.apiKey) {
        setSettingsOpen(true);
      }
    });
    return unsub;
  }, [setSettingsOpen, onHydrated]);

  // Reload models when connection settings change (after initial hydration).
  useEffect(() => {
    if (!booted.current) return;
    run();
  }, [ollamaHost, apiKey, run]);

  return null;
}
