"use client";

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Faceted diamond — matches REDSTONELOGO1 quadrant shading */
const FACETS = [
  { points: "50,50 50,4 96,50", fill: "#EF2B2D" },
  { points: "50,50 96,50 50,96", fill: "#C41E22" },
  { points: "50,50 50,96 4,50", fill: "#6B1215" },
  { points: "50,50 4,50 50,4", fill: "#A3181C" },
] as const;

interface RedstoneLogoProps {
  /** Gem only, or gem + wordmark */
  variant?: "mark" | "wordmark";
  size?: number;
  className?: string;
}

export function RedstoneMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className={cn("flex-shrink-0", className)}
    >
      {FACETS.map((f) => (
        <polygon key={f.points} points={f.points} fill={f.fill} />
      ))}
    </svg>
  );
}

export function RedstoneLogo({
  variant = "wordmark",
  size = 22,
  className,
}: RedstoneLogoProps) {
  const theme = useAppStore((s) => s.theme);

  if (variant === "mark") {
    return <RedstoneMark size={size} className={className} />;
  }

  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <RedstoneMark size={size} />
      <span
        className={cn(
          "text-[15px] font-medium tracking-tight truncate",
          theme === "dark" ? "text-[#e8eaed]" : "text-[#202124]"
        )}
      >
        Redstone
      </span>
    </div>
  );
}
