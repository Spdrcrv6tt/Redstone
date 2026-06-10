"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { ImageGenerationSpec } from "@/types/image-gen";

interface ImageLoaderProps {
  spec: ImageGenerationSpec;
  model?: string;
  onBuilt?: (url: string) => void;
}

export function ImageLoader({
  spec,
  model: modelProp,
  onBuilt,
}: ImageLoaderProps) {
  const settings = useAppStore((s) => s.settings);
  const onBuiltRef = useRef(onBuilt);
  onBuiltRef.current = onBuilt;

  const [imageUrl, setImageUrl] = useState<string | null>(spec.url ?? null);
  const [status, setStatus] = useState(
    spec.url ? "Ready" : "Allocating hardware..."
  );
  const [error, setError] = useState<string | null>(null);

  const model = modelProp ?? settings.defaultModel;

  useEffect(() => {
    if (spec.url) {
      setImageUrl(spec.url);
      setStatus("Ready");
      return;
    }

    let cancelled = false;
    let stageTimer: ReturnType<typeof setTimeout> | undefined;

    async function generate() {
      setError(null);
      setStatus("Allocating hardware...");
      setImageUrl(null);

      try {
        setStatus("Freeing VRAM...");
        stageTimer = setTimeout(() => {
          if (!cancelled) setStatus("Generating image...");
        }, 2500);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9 * 60 * 1000);

        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            positive_prompt: spec.positive_prompt,
            negative_prompt: spec.negative_prompt,
            model,
          }),
        });
        clearTimeout(timeout);

        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? `Generation failed (${res.status})`);
        }
        if (!data.url) {
          throw new Error("No image URL returned");
        }

        if (cancelled) return;

        setImageUrl(data.url!);
        onBuiltRef.current?.(data.url!);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof DOMException && err.name === "AbortError"
              ? "Generation timed out — ComfyUI may be stalled on VRAM. Close other GPU apps and try again."
              : err instanceof Error
                ? err.message
                : "Generation failed.";
          setError(message);
          setStatus("Generation failed.");
        }
      }
    }

    void generate();

    return () => {
      cancelled = true;
      if (stageTimer) clearTimeout(stageTimer);
    };
  }, [
    spec.url,
    spec.positive_prompt,
    spec.negative_prompt,
    model,
  ]);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={spec.positive_prompt.slice(0, 120)}
        className="my-4 w-full rounded-xl object-cover shadow-lg"
      />
    );
  }

  if (error) {
    return (
      <div className="my-4 flex h-64 w-full flex-col items-center justify-center rounded-xl border border-red-500/30 bg-[#1a1d26] p-4 text-center text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="my-4 flex h-64 w-full flex-col items-center justify-center rounded-xl border border-[#3a3f4b] bg-[#1a1d26] animate-pulse">
      <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-[#4cc9f0]" />
      <p className="font-medium tracking-wide text-gray-300">{status}</p>
    </div>
  );
}

export function ImageArchitectPending() {
  return (
    <div className="my-4 flex h-64 w-full items-center justify-center rounded-xl border border-dashed border-theme bg-surface-muted/60">
      <p className="text-sm text-muted">Engineering image prompt…</p>
    </div>
  );
}
