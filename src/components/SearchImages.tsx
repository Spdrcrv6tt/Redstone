"use client";

import { useEffect } from "react";
import type { SearchImage } from "@/types";

interface SearchImagePreloaderProps {
  images: SearchImage[];
  onReady: () => void;
}

/** Preload search images before the response is revealed. */
export function SearchImagePreloader({
  images,
  onReady,
}: SearchImagePreloaderProps) {
  useEffect(() => {
    let cancelled = false;
    const targets = images.slice(0, 1);
    if (targets.length === 0) {
      onReady();
      return;
    }

    let settled = 0;
    let anyLoaded = false;

    const done = () => {
      settled += 1;
      if (anyLoaded || settled >= targets.length) {
        if (!cancelled) onReady();
      }
    };

    for (const img of targets) {
      const probe = new window.Image();
      const tryThumb = () => {
        if (img.thumbnailUrl && img.thumbnailUrl !== probe.src) {
          probe.onerror = () => done();
          probe.src = img.thumbnailUrl;
          return;
        }
        done();
      };
      probe.onload = () => {
        anyLoaded = true;
        done();
      };
      probe.onerror = tryThumb;
      probe.src = img.imageUrl;
    }

    return () => {
      cancelled = true;
    };
  }, [images, onReady]);

  return null;
}
