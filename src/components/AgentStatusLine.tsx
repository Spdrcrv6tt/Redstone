"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { usePageVisible } from "@/hooks/usePageVisible";

interface AgentStatusLineProps {
  message: string;
}

const DOTS = [0, 1, 2] as const;
const ENTER_MS = 880;
const ORBIT_R = 7.5;

function lineOffset(i: number) {
  return (i - 1) * 9;
}

function organicPosition(t: number, index: number) {
  const phase = (index * 2 * Math.PI) / 3;
  const speed = 1.75 + index * 0.18;
  const angle = t * speed + phase;
  const swell = 1 + 0.28 * Math.sin(angle * 2.2 + phase * 1.3);
  const lunge = 0.72 + 0.28 * Math.cos(angle * 1.4 - phase * 0.85);
  const r = ORBIT_R * swell;
  return {
    x: Math.cos(angle) * r * lunge,
    y: Math.sin(angle) * r * (1.18 - lunge * 0.22),
    scale: 0.9 + 0.22 * Math.sin(angle + Math.PI / 2),
  };
}

function StatusDot({
  index,
  phase,
  reduceMotion,
}: {
  index: number;
  phase: "enter" | "work";
  reduceMotion: boolean | null;
}) {
  const x = useMotionValue(lineOffset(index));
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(reduceMotion ? 1 : 0);
  const pageVisible = usePageVisible();
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const pageVisibleRef = useRef(pageVisible);
  pageVisibleRef.current = pageVisible;
  const enteredRef = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      opacity.set(1);
      const p = organicPosition(0, index);
      x.set(p.x);
      y.set(p.y);
      scale.set(p.scale);
      return;
    }

    if (!enteredRef.current) {
      enteredRef.current = true;
      const delay = index * 0.1;
      opacity.set(0);
      y.set(9);
      scale.set(0.2);
      x.set(lineOffset(index));

      void animate(opacity, 1, { duration: 0.28, delay });
      void animate(y, 0, {
        type: "spring",
        stiffness: 320,
        damping: 11,
        mass: 1.35,
        delay,
      });
      void animate(scale, 1, {
        type: "spring",
        stiffness: 320,
        damping: 11,
        mass: 1.35,
        delay,
      });
    }
  }, [index, opacity, reduceMotion, scale, x, y]);

  useAnimationFrame((time) => {
    if (
      phaseRef.current !== "work" ||
      reduceMotion ||
      !pageVisibleRef.current
    ) {
      return;
    }
    const p = organicPosition(time / 1000, index);
    x.set(p.x);
    y.set(p.y);
    scale.set(p.scale);
  });

  const isWork = phase === "work";

  return (
    <motion.span
      className={[
        "agent-status-dot",
        isWork ? "agent-status-dot--work" : "",
        `agent-status-dot--${index}`,
      ].join(" ")}
      style={{ x, y, scale, opacity }}
    />
  );
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

  return (
    <div className="agent-status-line" role="status" aria-live="polite">
      <span className="agent-status-dots" data-phase={phase} aria-hidden="true">
        <span className="agent-status-orbit-track">
          {DOTS.map((i) => (
            <StatusDot
              key={i}
              index={i}
              phase={phase}
              reduceMotion={reduceMotion}
            />
          ))}
        </span>
      </span>
      <span className="agent-status-text">{message}</span>
    </div>
  );
}
