"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

interface AmbientBackgroundProps {
  /** True on new/empty chat — shows the top aurora curtain (Gemini-style). */
  active: boolean;
}

export function AmbientBackground({ active }: AmbientBackgroundProps) {
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === "dark";

  return (
    <div
      className={[
        "ambient-bg fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none",
        active ? "ambient-active" : "",
      ].join(" ")}
    >
      <div className="ambient-base absolute inset-0" />

      {/* Gemini-style top aurora — fades out once the user sends a message */}
      <motion.div
        className="ambient-gemini-sky absolute inset-x-0 top-0"
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        aria-hidden
      />

      <motion.div
        className="ambient-aurora absolute inset-0"
        initial={false}
        animate={{ opacity: active ? (isDark ? 0.45 : 0.55) : 0 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      />

      <motion.div
        className={`ambient-orb ambient-orb-1 absolute rounded-full will-change-transform ${
          isDark
            ? "top-[4%] left-[25%] w-[min(720px,90vw)] h-[min(280px,32vh)]"
            : "top-[6%] left-1/2 -translate-x-1/2 w-[min(800px,92vw)] h-[min(260px,30vh)]"
        }`}
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      />

      <motion.div
        className={`ambient-orb ambient-orb-2 absolute rounded-full will-change-transform ${
          isDark
            ? "top-[2%] right-[8%] w-[min(520px,70vw)] h-[min(220px,26vh)]"
            : "top-[4%] right-[12%] w-[min(480px,65vw)] h-[min(200px,24vh)]"
        }`}
        initial={false}
        animate={{ opacity: active ? 0.85 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      />

      <motion.div
        className="ambient-vignette absolute inset-0"
        initial={false}
        animate={{ opacity: active ? 1 : 0.35 }}
        transition={{ duration: 0.55 }}
      />
    </div>
  );
}
