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

  const fade = { duration: 0.55, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <div className="ambient-bg fixed inset-0 overflow-hidden pointer-events-none select-none">
      <div className="ambient-base absolute inset-0" />

      <motion.div
        className="ambient-gemini-sky absolute inset-x-0 top-0"
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={fade}
        aria-hidden
      />

      <motion.div
        className="ambient-aurora absolute inset-x-0 top-0 h-[55vh]"
        initial={false}
        animate={{ opacity: active ? (isDark ? 0.7 : 0.5) : 0 }}
        transition={fade}
      />

      <motion.div
        className={`ambient-orb ambient-orb-1 absolute rounded-full will-change-transform ${
          isDark
            ? "top-[2%] left-[20%] w-[min(760px,95vw)] h-[min(300px,34vh)]"
            : "top-[4%] left-1/2 -translate-x-1/2 w-[min(820px,95vw)] h-[min(280px,32vh)]"
        }`}
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={fade}
      />

      <motion.div
        className={`ambient-orb ambient-orb-2 absolute rounded-full will-change-transform ${
          isDark
            ? "top-[0%] right-[5%] w-[min(560px,75vw)] h-[min(240px,28vh)]"
            : "top-[2%] right-[10%] w-[min(500px,70vw)] h-[min(220px,26vh)]"
        }`}
        initial={false}
        animate={{ opacity: active ? 0.9 : 0 }}
        transition={fade}
      />
    </div>
  );
}
