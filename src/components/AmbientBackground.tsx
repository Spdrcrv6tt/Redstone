"use client";

import { useAppStore } from "@/lib/store";

export function AmbientBackground() {
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === "dark";

  return (
    <div className="ambient-bg fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none">
      <div className="ambient-base absolute inset-0" />

      {/* Aurora mesh — hue shifts over time */}
      <div className="ambient-aurora absolute inset-0 opacity-55" />

      {/* Primary orb */}
      <div
        className={`ambient-orb ambient-orb-1 absolute rounded-full will-change-transform ${
          isDark
            ? "top-[10%] left-[30%] w-[min(800px,85vw)] h-[min(500px,55vh)]"
            : "top-[12%] left-1/2 -translate-x-1/2 w-[min(900px,90vw)] h-[min(500px,50vh)]"
        }`}
      />

      {/* Secondary orb */}
      <div
        className={`ambient-orb ambient-orb-2 absolute rounded-full will-change-transform ${
          isDark
            ? "top-[40%] right-[10%] w-[min(600px,70vw)] h-[min(450px,45vh)]"
            : "top-[32%] left-[55%] w-[min(600px,70vw)] h-[min(400px,40vh)]"
        }`}
      />

      {/* Tertiary accent orb */}
      <div
        className={`ambient-orb ambient-orb-3 absolute rounded-full will-change-transform ${
          isDark
            ? "bottom-[15%] left-[15%] w-[min(500px,60vw)] h-[min(350px,35vh)]"
            : "bottom-[20%] right-[20%] w-[min(450px,55vw)] h-[min(300px,30vh)]"
        }`}
      />

      {/* Sweeping light rays */}
      <div className="ambient-ray ambient-ray-1 absolute" />
      <div className="ambient-ray ambient-ray-2 absolute" />
      <div className="ambient-ray ambient-ray-3 absolute" />

      {/* Soft vignette */}
      <div className="ambient-vignette absolute inset-0" />
    </div>
  );
}
