"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

const FADE = { duration: 0.65, ease: [0.4, 0, 0.2, 1] as const };

export function AmbientBackground() {
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === "dark";

  return (
    <motion.div
      className="ambient-bg absolute inset-0 overflow-hidden pointer-events-none select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={FADE}
      aria-hidden
    >
      <div className="ambient-base absolute inset-0" />

      <div className="ambient-aurora-mask absolute inset-x-0 top-0 h-[58vh]">
        <div className="ambient-gemini-sky ambient-gemini-sky-animate absolute inset-0" />

        <div className="ambient-aurora ambient-aurora-animate absolute inset-0" />

        <div
          className={`ambient-orb ambient-orb-1 ambient-orb-animate absolute rounded-full will-change-transform ${
            isDark
              ? "top-[2%] left-[18%] w-[min(720px,92vw)] h-[min(280px,32vh)]"
              : "top-[4%] left-1/2 -translate-x-1/2 w-[min(780px,92vw)] h-[min(260px,30vh)]"
          }`}
        />

        <div
          className={`ambient-orb ambient-orb-2 ambient-orb-animate-alt absolute rounded-full will-change-transform ${
            isDark
              ? "top-[0%] right-[4%] w-[min(520px,72vw)] h-[min(220px,26vh)]"
              : "top-[2%] right-[8%] w-[min(480px,68vw)] h-[min(200px,24vh)]"
          }`}
        />

        <div
          className={`ambient-orb ambient-orb-3 ambient-orb-animate-slow absolute rounded-full will-change-transform ${
            isDark
              ? "top-[8%] left-[42%] w-[min(400px,55vw)] h-[min(180px,20vh)]"
              : "top-[10%] left-[38%] w-[min(360px,50vw)] h-[min(160px,18vh)]"
          }`}
        />
      </div>
    </motion.div>
  );
}
