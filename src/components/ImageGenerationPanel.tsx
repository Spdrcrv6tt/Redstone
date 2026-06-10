"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ImageForgeCanvas } from "@/components/ImageForgeCanvas";

export type ImageGenStage = "architect" | "allocate" | "vram" | "diffuse" | "error";

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
}

export function ImageGenerationPanel({
  stage,
  error,
}: ImageGenerationPanelProps) {
  const isError = stage === "error";
  const label = isError ? "Couldn't create image" : "Creating image";
  const [borderColor, setBorderColor] = useState("rgb(255, 0, 0)");

  return (
    <div className="image-forge my-4" role="status" aria-live="polite">
      <p className="image-forge-label">{label}</p>

      <div
        className={[
          "image-forge-stage",
          isError ? "image-forge-stage--error" : "",
        ].join(" ")}
        style={{ "--forge-border-color": borderColor } as React.CSSProperties}
      >
        <ImageForgeCanvas dimmed={isError} onAccentColor={setBorderColor} />
        <div className="image-forge-edge" aria-hidden />
      </div>

      {isError && error ? (
        <p className="image-forge-error">{error}</p>
      ) : null}
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
      className="image-forge-result my-4"
      initial={{ opacity: 0, scale: 0.992 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="image-forge-label image-forge-label--done">Created</p>
      <div className="image-forge-stage image-forge-stage--done">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="image-forge-result-img" />
        <div className="image-forge-edge image-forge-edge--done" aria-hidden />
      </div>
    </motion.div>
  );
}
