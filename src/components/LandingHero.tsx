"use client";

import { motion } from "framer-motion";
import { Flame, Code2, Pencil, Lightbulb, Search } from "lucide-react";
import { useAppStore } from "@/lib/store";

const SUGGESTIONS = [
  { icon: Code2,      label: "Write some code" },
  { icon: Pencil,     label: "Help me write"   },
  { icon: Lightbulb, label: "Explain a concept" },
  { icon: Search,     label: "Research a topic" },
];

interface LandingHeroProps {
  onSend: (msg: string) => void;
}

export function LandingHero({ onSend }: LandingHeroProps) {
  const { settings } = useAppStore();
  const model = settings.defaultModel;

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full px-6 pb-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.18 } }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Logo */}
      <motion.div
        className="relative mb-7"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-16 h-16 rounded-[18px] flex items-center justify-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(249,115,22,0.06) 100%)",
            border: "1px solid rgba(249,115,22,0.22)",
            boxShadow: "0 0 40px rgba(249,115,22,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <Flame className="w-7 h-7 text-orange-400" />
          {/* Inner shine */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/30 to-transparent" />
        </div>
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-[18px] blur-2xl bg-orange-500/20 -z-10 scale-150" />
      </motion.div>

      {/* Heading */}
      <motion.h1
        className="text-[2rem] font-semibold text-zinc-100 mb-3 text-center tracking-tight"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        What can I help with?
      </motion.h1>

      {/* Model pill */}
      <motion.p
        className="text-sm text-zinc-500 mb-10 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
      >
        {model ? (
          <>Running <span className="text-zinc-400 font-medium">{model}</span> locally</>
        ) : (
          "Select a model in Settings to get started"
        )}
      </motion.p>

      {/* Suggestion chips */}
      <motion.div
        className="flex flex-wrap gap-2 justify-center max-w-lg"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
      >
        {SUGGESTIONS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            onClick={() => onSend(label)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-zinc-400 transition-all duration-200 group"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
              (e.currentTarget as HTMLElement).style.color = "#e4e4e7";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
              (e.currentTarget as HTMLElement).style.color = "";
            }}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {label}
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
