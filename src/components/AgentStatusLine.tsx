"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface AgentStatusLineProps {
  message: string;
}

const DOTS = [0, 1, 2] as const;
const ENTER_MS = 880;
const ORBIT_R = 6.5;
const DOT_COLORS = ["#f87171", "#4ade80", "#60a5fa"] as const;

function lineOffset(i: number) {
  return (i - 1) * 9;
}

function orbitOffset(i: number) {
  const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
  return {
    x: Math.cos(angle) * ORBIT_R,
    y: Math.sin(angle) * ORBIT_R,
  };
}

export function AgentStatusLine({ message }: AgentStatusLineProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<"enter" | "work">("enter");

  useEffect(() => {
    if (reduceMotion) {
      setPhase("work");
      return;
    }
    const t = window.setTimeout(() => setPhase("work"), ENTER_MS);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  const isWork = phase === "work";

  return (
    <div className="agent-status-line" role="status" aria-live="polite">
      <span className="agent-status-dots" data-phase={phase} aria-hidden="true">
        <motion.span
          className="agent-status-orbit-track"
          animate={{ rotate: isWork && !reduceMotion ? 360 : 0 }}
          transition={
            isWork && !reduceMotion
              ? { duration: 2.35, repeat: Infinity, ease: "linear" }
              : { duration: 0.35 }
          }
        >
          {DOTS.map((i) => {
            const orbit = orbitOffset(i);
            return (
              <motion.span
                key={i}
                className="agent-status-dot"
                initial={
                  reduceMotion
                    ? { opacity: 1, x: orbit.x, y: orbit.y, scale: 1 }
                    : { opacity: 0, y: 7, scale: 0.3, x: lineOffset(i) }
                }
                animate={{
                  opacity: isWork && !reduceMotion ? [0.55, 1, 0.55] : 1,
                  x: isWork ? orbit.x : lineOffset(i),
                  y: isWork ? orbit.y : 0,
                  scale: isWork && !reduceMotion ? [0.92, 1.08, 0.92] : 1,
                  backgroundColor: isWork
                    ? DOT_COLORS[i]
                    : "var(--text-muted)",
                }}
                transition={{
                  opacity: isWork
                    ? {
                        duration: 1.35,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.18,
                      }
                    : { duration: 0.3, delay: i * 0.11 },
                  x: {
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  y: reduceMotion
                    ? { duration: 0 }
                    : isWork
                      ? {
                          duration: 0.6,
                          ease: [0.22, 1, 0.36, 1],
                        }
                      : {
                          duration: 0.48,
                          delay: i * 0.11,
                          type: "spring",
                          stiffness: 460,
                          damping: 16,
                        },
                  scale: isWork
                    ? {
                        duration: 1.35,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.18,
                      }
                    : {
                        duration: 0.48,
                        delay: i * 0.11,
                        type: "spring",
                        stiffness: 460,
                        damping: 16,
                      },
                  backgroundColor: { duration: 0.45, ease: "easeOut" },
                }}
                style={{
                  boxShadow: isWork
                    ? `0 0 7px ${DOT_COLORS[i]}99`
                    : "0 0 0 transparent",
                }}
              />
            );
          })}
        </motion.span>
      </span>
      <span className="agent-status-text">{message}</span>
    </div>
  );
}
