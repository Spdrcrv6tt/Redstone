"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface AgentStatusLineProps {
  message: string;
}

const DOTS = [0, 1, 2] as const;
const ENTER_MS = 880;
const ORBIT_R = 7.5;

/** Vivid saturated cycle — each dot drifts through the full spectrum */
const COLOR_CYCLE = [
  "#ff1a5c",
  "#ff5c00",
  "#ffb300",
  "#39ff14",
  "#00f5ff",
  "#0066ff",
  "#a855f7",
  "#ff1a5c",
] as const;

function lineOffset(i: number) {
  return (i - 1) * 9;
}

/** Wobbly elliptical path — reads as weighted, not a rigid spinner */
function buildOrganicPath(i: number, steps = 10) {
  const phase = (i * 2 * Math.PI) / 3;
  const xs: number[] = [];
  const ys: number[] = [];
  const scales: number[] = [];

  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * 2 * Math.PI;
    const swell = 1 + 0.28 * Math.sin(t * 2.2 + phase * 1.3);
    const lunge = 0.72 + 0.28 * Math.cos(t * 1.4 - phase * 0.85);
    const r = ORBIT_R * swell;
    xs.push(Math.cos(t + phase) * r * lunge);
    ys.push(Math.sin(t + phase) * r * (1.18 - lunge * 0.22));
    // Heavier at bottom of arc, lighter at top — perceived mass
    scales.push(0.9 + 0.22 * Math.sin(t + phase + Math.PI / 2));
  }

  return { xs, ys, scales };
}

function glowForColor(hex: string, intensity = 1) {
  return `0 0 ${6 * intensity}px ${hex}cc, 0 0 ${14 * intensity}px ${hex}66`;
}

const GLOW_CYCLE = COLOR_CYCLE.map((c) => glowForColor(c));

export function AgentStatusLine({ message }: AgentStatusLineProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<"enter" | "work">("enter");

  const paths = useMemo(
    () => DOTS.map((i) => buildOrganicPath(i)),
    []
  );

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
        {isWork && !reduceMotion ? (
          <motion.span
            className="agent-status-glow-halo"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0.25, 0.5, 0.25], scale: [0.9, 1.15, 0.9] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: [0.45, 0.05, 0.25, 1],
            }}
          />
        ) : null}

        <span className="agent-status-orbit-track">
          {DOTS.map((i) => {
            const path = paths[i];
            const colorOffset = i * 2;

            return (
              <motion.span
                key={i}
                className="agent-status-dot"
                initial={
                  reduceMotion
                    ? { opacity: 1, x: path.xs[0], y: path.ys[0], scale: 1 }
                    : { opacity: 0, y: 9, scale: 0.2, x: lineOffset(i) }
                }
                animate={
                  isWork
                    ? {
                        opacity: [0.75, 1, 0.82, 1, 0.75],
                        x: path.xs,
                        y: path.ys,
                        scale: path.scales,
                        backgroundColor: [
                          ...COLOR_CYCLE.slice(colorOffset),
                          ...COLOR_CYCLE.slice(0, colorOffset),
                        ],
                        boxShadow: [
                          ...GLOW_CYCLE.slice(colorOffset),
                          ...GLOW_CYCLE.slice(0, colorOffset),
                        ],
                      }
                    : {
                        opacity: 1,
                        x: lineOffset(i),
                        y: 0,
                        scale: 1,
                        backgroundColor: "var(--text-muted)",
                        boxShadow: "0 0 0 transparent",
                      }
                }
                transition={
                  isWork
                    ? {
                        opacity: {
                          duration: 2.4 + i * 0.25,
                          repeat: Infinity,
                          ease: [0.42, 0, 0.18, 1],
                        },
                        x: {
                          duration: 2.55 + i * 0.38,
                          repeat: Infinity,
                          ease: [0.42, 0.02, 0.28, 1],
                        },
                        y: {
                          duration: 2.55 + i * 0.38,
                          repeat: Infinity,
                          ease: [0.42, 0.02, 0.28, 1],
                        },
                        scale: {
                          duration: 2.55 + i * 0.38,
                          repeat: Infinity,
                          ease: [0.42, 0.02, 0.28, 1],
                        },
                        backgroundColor: {
                          duration: 3.6,
                          repeat: Infinity,
                          ease: "linear",
                          delay: i * 0.45,
                        },
                        boxShadow: {
                          duration: 3.6,
                          repeat: Infinity,
                          ease: "linear",
                          delay: i * 0.45,
                        },
                      }
                    : {
                        opacity: { duration: 0.28, delay: i * 0.1 },
                        x: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                        y: {
                          duration: 0.55,
                          delay: i * 0.1,
                          type: "spring",
                          stiffness: 320,
                          damping: 11,
                          mass: 1.35,
                        },
                        scale: {
                          duration: 0.55,
                          delay: i * 0.1,
                          type: "spring",
                          stiffness: 320,
                          damping: 11,
                          mass: 1.35,
                        },
                        backgroundColor: { duration: 0.35 },
                        boxShadow: { duration: 0.35 },
                      }
                }
              />
            );
          })}
        </span>
      </span>
      <span className="agent-status-text">{message}</span>
    </div>
  );
}
