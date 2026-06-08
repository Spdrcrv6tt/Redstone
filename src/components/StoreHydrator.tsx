"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Triggers Zustand's persist rehydration from localStorage after the first
 * client paint. Must be rendered inside the client tree but outside any
 * component that reads persisted state to avoid tearing.
 */
export function StoreHydrator() {
  useEffect(() => {
    useAppStore.persist.rehydrate();
  }, []);
  return null;
}
