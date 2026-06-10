"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  ImageGenResult,
  ImageGenerationPanel,
  statusToStage,
} from "@/components/ImageGenerationPanel";
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

        setImageUrl(data.url);
        onBuiltRef.current?.(data.url);
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
  }, [spec.url, spec.positive_prompt, spec.negative_prompt, model]);

  if (imageUrl) {
    return (
      <ImageGenResult
        src={imageUrl}
        alt={spec.positive_prompt.slice(0, 120)}
      />
    );
  }

  if (error) {
    return <ImageGenerationPanel stage="error" error={error} />;
  }

  return <ImageGenerationPanel stage={statusToStage(status)} />;
}

export function ImageArchitectPending() {
  return <ImageGenerationPanel stage="architect" />;
}
