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

      <div className="ambient-aurora-mask absolute inset-x-0 -top-[6vh] h-[76vh]">
        <div className="ambient-sky-field absolute inset-x-0">
          <div className="ambient-gemini-sky ambient-gemini-sky-animate absolute inset-0" />
          <div className="ambient-gemini-sky ambient-gemini-sky-alt ambient-gemini-sky-alt-animate absolute inset-0" />
          <div className="ambient-aurora ambient-aurora-animate absolute inset-0" />
          <div className="ambient-bloom ambient-bloom-animate absolute inset-0" />
        </div>

        <div
          className={`ambient-orb ambient-orb-1 absolute rounded-full ${
            isDark
              ? "top-[0%] left-[12%] w-[min(840px,98vw)] h-[min(300px,34vh)]"
              : "top-[2%] left-1/2 -translate-x-1/2 w-[min(860px,96vw)] h-[min(280px,32vh)]"
          }`}
        />

        <div
          className={`ambient-orb ambient-orb-2 absolute rounded-full ${
            isDark
              ? "top-[2%] right-[0%] w-[min(620px,80vw)] h-[min(260px,30vh)]"
              : "top-[4%] right-[4%] w-[min(560px,74vw)] h-[min(240px,28vh)]"
          }`}
        />

        <div
          className={`ambient-orb ambient-orb-3 absolute rounded-full ${
            isDark
              ? "top-[6%] left-[38%] w-[min(480px,62vw)] h-[min(200px,22vh)]"
              : "top-[8%] left-[34%] w-[min(440px,58vw)] h-[min(180px,20vh)]"
          }`}
        />

        <div
          className={`ambient-orb ambient-orb-4 absolute rounded-full ${
            isDark
              ? "top-[4%] right-[28%] w-[min(360px,48vw)] h-[min(160px,18vh)]"
              : "top-[6%] right-[24%] w-[min(320px,44vw)] h-[min(140px,16vh)]"
          }`}
        />

        <div className="ambient-aurora-feather absolute inset-x-0 bottom-0 h-[52%]" />
      </div>
    </motion.div>
  );
}
