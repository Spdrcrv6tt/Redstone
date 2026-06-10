"use client";

import { motion } from "framer-motion";

export type ImageGenStage = "architect" | "allocate" | "vram" | "diffuse" | "error";

const STAGES: { id: ImageGenStage; label: string }[] = [
  { id: "allocate", label: "Allocate" },
  { id: "vram", label: "VRAM" },
  { id: "diffuse", label: "Diffuse" },
];

const STAGE_COPY: Record<ImageGenStage, { title: string; subtitle: string }> = {
  architect: {
    title: "Architecting prompt",
    subtitle: "Translating your idea into diffusion weights",
  },
  allocate: {
    title: "Reserving compute",
    subtitle: "Claiming GPU time on the inference cluster",
  },
  vram: {
    title: "Clearing VRAM",
    subtitle: "Evicting language models to free the canvas",
  },
  diffuse: {
    title: "Synthesizing image",
    subtitle: "Diffusion steps in progress — this may take a minute",
  },
  error: {
    title: "Generation failed",
    subtitle: "The pipeline could not complete this request",
  },
};

export function statusToStage(status: string): ImageGenStage {
  if (status.includes("Allocat")) return "allocate";
  if (status.includes("VRAM") || status.includes("Freeing")) return "vram";
  if (status.includes("Generat") || status.includes("Synthes")) return "diffuse";
  if (status.includes("fail") || status.includes("timed out")) return "error";
  return "diffuse";
}

interface ImageGenerationPanelProps {
  stage: ImageGenStage;
  error?: string | null;
  showPipeline?: boolean;
}

export function ImageGenerationPanel({
  stage,
  error,
  showPipeline = true,
}: ImageGenerationPanelProps) {
  const copy = STAGE_COPY[stage];
  const activeIndex =
    stage === "architect"
      ? -1
      : stage === "allocate"
        ? 0
        : stage === "vram"
          ? 1
          : stage === "diffuse"
            ? 2
            : -1;

  return (
    <div className="image-gen-shell my-4" role="status" aria-live="polite">
      <div className="image-gen-border-glow" aria-hidden />
      <div className="image-gen-aurora" aria-hidden />
      <div className="image-gen-grid" aria-hidden />
      <div className="image-gen-vignette" aria-hidden />

      <div className="image-gen-content">
        <div className="image-gen-synthesis" aria-hidden>
          <div className="image-gen-ring image-gen-ring--1" />
          <div className="image-gen-ring image-gen-ring--2" />
          <div className="image-gen-ring image-gen-ring--3" />
          <div className="image-gen-core">
            <div className="image-gen-core-inner" />
          </div>
          <div className="image-gen-orbit">
            <span className="image-gen-particle image-gen-particle--0" />
            <span className="image-gen-particle image-gen-particle--1" />
            <span className="image-gen-particle image-gen-particle--2" />
          </div>
        </div>

        <div className="image-gen-copy">
          <p className="image-gen-eyebrow">Redstone · Image synthesis</p>
          <h3 className="image-gen-title">{copy.title}</h3>
          <p className="image-gen-subtitle">
            {stage === "error" && error ? error : copy.subtitle}
          </p>
        </div>

        {showPipeline && stage !== "architect" && stage !== "error" ? (
          <ol className="image-gen-pipeline">
            {STAGES.map((s, i) => (
              <li
                key={s.id}
                className={[
                  "image-gen-pipeline-step",
                  i < activeIndex
                    ? "is-done"
                    : i === activeIndex
                      ? "is-active"
                      : "",
                ].join(" ")}
              >
                <span className="image-gen-pipeline-dot" />
                <span className="image-gen-pipeline-label">{s.label}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="image-gen-corners" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function ImageGenResult({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <motion.div
      className="image-gen-result-wrap my-4"
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="image-gen-result-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="image-gen-result-img" />
      </div>
    </motion.div>
  );
}
