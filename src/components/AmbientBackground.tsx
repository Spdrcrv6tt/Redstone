"use client";

import { motion } from "framer-motion";
import { usePageVisible } from "@/hooks/usePageVisible";

const FADE = { duration: 0.65, ease: [0.4, 0, 0.2, 1] as const };

export function AmbientBackground() {
  const live = usePageVisible();

  return (
    <motion.div
      className={[
        "ambient-bg absolute inset-0 overflow-hidden pointer-events-none select-none",
        live ? "ambient-bg--live" : "ambient-bg--paused",
      ].join(" ")}
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
        </div>

        <div className="ambient-orb ambient-orb-1 absolute rounded-full" />
        <div className="ambient-orb ambient-orb-2 absolute rounded-full" />

        <div className="ambient-aurora-feather absolute inset-x-0 bottom-0 h-[52%]" />
      </div>
    </motion.div>
  );
}
