"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { usePageVisible } from "@/hooks/usePageVisible";
import {
  normalizeThinkingOrbs,
  thinkingOrbPosition,
} from "@/lib/thinking-orbs";
import { useAppStore } from "@/lib/store";

interface AgentStatusLineProps {
  message: string;
}

const ENTER_MS = 640;

function lineOffset(i: number, count: number) {
  const mid = (count - 1) / 2;
  return (i - mid) * 9;
}

function StatusDot({
  index,
  count,
  color,
  phase,
  reduceMotion,
  orbConfig,
}: {
  index: number;
  count: number;
  color: string;
  phase: "enter" | "work";
  reduceMotion: boolean | null;
  orbConfig: ReturnType<typeof normalizeThinkingOrbs>;
}) {
  const x = useMotionValue(lineOffset(index, count));
  const y = useMotionValue(0);
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
      const p = thinkingOrbPosition(0, index, orbConfig);
      x.set(p.x);
      y.set(p.y);
      return;
    }

    if (!enteredRef.current) {
      enteredRef.current = true;
      const delay = index * 0.08;
      opacity.set(0);
      y.set(8);
      x.set(lineOffset(index, count));

      void animate(opacity, 1, { duration: 0.18, delay });
      void animate(y, 0, {
        type: "spring",
        stiffness: 420,
        damping: 14,
        mass: 1,
        delay,
      });
    }
  }, [count, index, opacity, orbConfig, reduceMotion, x, y]);

  useAnimationFrame((time) => {
    if (
      phaseRef.current !== "work" ||
      reduceMotion ||
      !pageVisibleRef.current
    ) {
      return;
    }
    const p = thinkingOrbPosition(time / 1000, index, orbConfig);
    x.set(p.x);
    y.set(p.y);
  });

  const isWork = phase === "work";

  return (
    <motion.span
      className={["agent-status-dot", isWork ? "agent-status-dot--work" : ""].join(
        " "
      )}
      style={{
        x,
        y,
        opacity,
        backgroundColor: isWork ? color : undefined,
        width: isWork ? "0.5rem" : undefined,
        height: isWork ? "0.5rem" : undefined,
        margin: isWork ? "-0.25rem 0 0 -0.25rem" : undefined,
      }}
    />
  );
}

export function AgentStatusLine({ message }: AgentStatusLineProps) {
  const reduceMotion = useReducedMotion();
  const thinkingOrbs = useAppStore((s) => s.settings.thinkingOrbs);
  const orbConfig = useMemo(
    () => normalizeThinkingOrbs(thinkingOrbs),
    [thinkingOrbs]
  );
  const [phase, setPhase] = useState<"enter" | "work">("enter");

  const indices = useMemo(
    () => Array.from({ length: orbConfig.count }, (_, i) => i),
    [orbConfig.count]
  );

  const trackSize = orbConfig.radius * 2.6;

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
      <span
        className="agent-status-dots"
        data-phase={phase}
        style={
          phase === "work"
            ? { width: trackSize, height: trackSize }
            : undefined
        }
        aria-hidden="true"
      >
        <span
          className="agent-status-orbit-track"
          style={
            phase === "work"
              ? { width: trackSize, height: trackSize }
              : undefined
          }
        >
          {indices.map((i) => (
            <StatusDot
              key={i}
              index={i}
              count={orbConfig.count}
              color={orbConfig.colors[i] ?? "#ff0000"}
              phase={phase}
              reduceMotion={reduceMotion}
              orbConfig={orbConfig}
            />
          ))}
        </span>
      </span>
      <span className="agent-status-text">{message}</span>
    </div>
  );
}
