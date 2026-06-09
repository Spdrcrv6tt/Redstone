"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { getDynamicGreeting } from "@/lib/greetings";

export function LandingGreeting() {
  const displayName = useAppStore((s) => s.settings.displayName);

  const greeting = useMemo(
    () => getDynamicGreeting(displayName),
    [displayName]
  );

  return (
    <motion.div
      className="landing-greeting text-center px-4 md:px-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <AnimatePresence mode="wait">
        <motion.h1
          key={`${greeting.before}${greeting.highlight ?? ""}${greeting.after}`}
          className="text-[1.625rem] sm:text-[2rem] md:text-[2.75rem] leading-[1.2] font-normal text-primary tracking-tight"
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {greeting.before}
          {greeting.highlight && (
            <span className="greeting-accent">{greeting.highlight}</span>
          )}
          {greeting.after}
        </motion.h1>
      </AnimatePresence>
    </motion.div>
  );
}
