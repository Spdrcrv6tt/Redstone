"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { usePageVisible } from "@/hooks/usePageVisible";

const FADE = { duration: 0.65, ease: [0.4, 0, 0.2, 1] as const };

type AmbientOrbProps = {
  className: string;
  baseDuration: number;
};

function AmbientOrb({ className, baseDuration }: AmbientOrbProps) {
  const [duration, setDuration] = useState(baseDuration);

  useEffect(() => {
    const retime = () => {
      const factor = 0.5 + Math.random() * 1.1;
      setDuration(baseDuration * factor);
    };

    retime();
    let timerId = 0;

    const schedule = () => {
      const delay = 3500 + Math.random() * 5500;
      timerId = window.setTimeout(() => {
        retime();
        schedule();
      }, delay);
    };

    schedule();
    return () => window.clearTimeout(timerId);
  }, [baseDuration]);

  return (
    <div
      className={`ambient-orb absolute rounded-full ${className}`}
      style={{ animationDuration: `${duration}s` }}
    />
  );
}

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

        <AmbientOrb className="ambient-orb-1" baseDuration={9} />
        <AmbientOrb className="ambient-orb-2" baseDuration={11} />
        <AmbientOrb className="ambient-orb-3" baseDuration={7.5} />

        <div className="ambient-aurora-feather absolute inset-x-0 bottom-0 h-[52%]" />
      </div>
    </motion.div>
  );
}
