"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";

/**
 * After the store has rehydrated, if the API key is still empty
 * automatically open the Settings modal so the user can configure it.
 */
export function FirstRunGate() {
  const { settings, setSettingsOpen } = useAppStore();
  const checked = useRef(false);

  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      if (checked.current) return;
      checked.current = true;
      const { settings } = useAppStore.getState();
      if (!settings.apiKey) {
        setSettingsOpen(true);
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
