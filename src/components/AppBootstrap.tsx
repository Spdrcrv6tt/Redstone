"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";

/** Hydrate store, apply theme, and open settings on first run if needed. */
export function AppBootstrap() {
  const theme = useAppStore((s) => s.theme);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const checked = useRef(false);

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
      if (!useAppStore.getState().settings.apiKey) {
        setSettingsOpen(true);
      }
    });
    return unsub;
  }, [setSettingsOpen]);

  return null;
}
