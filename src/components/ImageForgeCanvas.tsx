"use client";

import { useEffect, useRef } from "react";
import { usePageVisible } from "@/hooks/usePageVisible";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Animated gradient forge — filled color field with hot edge bloom. */
export function ImageForgeCanvas({ dimmed = false }: { dimmed?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visible = usePageVisible();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawEdges = (
      w: number,
      h: number,
      pulse: number,
      intensity: number
    ) => {
      const band = Math.max(3, Math.min(w, h) * 0.045);
      const alpha = lerp(0.55, 1, pulse) * intensity;

      const sides: [number, number, number, number, number, number][] = [
        [0, 0, w, band, 0, band * 2.2],
        [0, h - band, w, band, 0, -band * 2.2],
        [0, 0, band, h, band * 2.2, 0],
        [w - band, 0, band, h, -band * 2.2, 0],
      ];

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const [x, y, bw, bh, gx, gy] of sides) {
        const g = ctx.createLinearGradient(x, y, x + gx, y + gy);
        g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        g.addColorStop(0.35, `rgba(255, 240, 230, ${alpha * 0.55})`);
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, bw, bh);
      }

      const cornerR = band * 2.8;
      const corners: [number, number][] = [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ];
      for (const [cx, cy] of corners) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cornerR);
        g.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
        g.addColorStop(0.5, `rgba(255, 220, 200, ${alpha * 0.35})`);
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - cornerR, cy - cornerR, cornerR * 2, cornerR * 2);
      }
      ctx.restore();
    };

    const draw = (time: number) => {
      if (!running || !visible) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 1 || h < 1) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const t = time * 0.001;
      const pulse = (Math.sin(t * 2.1) + 1) * 0.5;
      const intensity = dimmed ? 0.45 : 1;

      ctx.fillStyle = dimmed ? "#120a10" : "#0d0612";
      ctx.fillRect(0, 0, w, h);

      const blobs = [
        {
          x: 0.28 + Math.sin(t * 0.38) * 0.14,
          y: 0.38 + Math.cos(t * 0.31) * 0.11,
          r: 0.62,
          h: 285 + Math.sin(t * 0.5) * 18,
          s: 78,
          l: dimmed ? 42 : 52,
          a: 0.82,
        },
        {
          x: 0.72 + Math.cos(t * 0.44) * 0.12,
          y: 0.42 + Math.sin(t * 0.36) * 0.09,
          r: 0.56,
          h: 18 + Math.cos(t * 0.4) * 12,
          s: 88,
          l: dimmed ? 48 : 58,
          a: 0.78,
        },
        {
          x: 0.52 + Math.sin(t * 0.27) * 0.18,
          y: 0.68 + Math.cos(t * 0.22) * 0.07,
          r: 0.5,
          h: 210 + Math.sin(t * 0.6) * 22,
          s: 72,
          l: dimmed ? 40 : 50,
          a: 0.72,
        },
        {
          x: 0.44 + Math.cos(t * 0.52) * 0.1,
          y: 0.22 + Math.sin(t * 0.48) * 0.08,
          r: 0.44,
          h: 330 + Math.cos(t * 0.35) * 15,
          s: 70,
          l: dimmed ? 45 : 55,
          a: 0.68,
        },
        {
          x: 0.58 + Math.sin(t * 0.65) * 0.08,
          y: 0.5 + Math.cos(t * 0.55) * 0.06,
          r: 0.38,
          h: 45 + Math.sin(t * 0.8) * 10,
          s: 95,
          l: dimmed ? 50 : 62,
          a: 0.55,
        },
      ];

      ctx.globalCompositeOperation = "screen";
      for (const b of blobs) {
        const radius = b.r * Math.max(w, h);
        const grd = ctx.createRadialGradient(
          b.x * w,
          b.y * h,
          0,
          b.x * w,
          b.y * h,
          radius
        );
        grd.addColorStop(
          0,
          `hsla(${b.h}, ${b.s}%, ${b.l}%, ${b.a * intensity})`
        );
        grd.addColorStop(0.45, `hsla(${b.h + 20}, ${b.s - 10}%, ${b.l - 8}%, ${b.a * 0.45 * intensity})`);
        grd.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalCompositeOperation = "lighter";
      const coreX = w * (0.5 + Math.sin(t * 0.19) * 0.025);
      const coreY = h * (0.5 + Math.cos(t * 0.17) * 0.02);
      const coreR = Math.min(w, h) * (0.42 + Math.sin(t * 1.15) * 0.035);
      const core = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
      const coreWhite = (0.28 + pulse * 0.18) * intensity;
      core.addColorStop(0, `rgba(255, 255, 255, ${coreWhite})`);
      core.addColorStop(0.18, `rgba(255, 200, 160, ${0.38 * intensity})`);
      core.addColorStop(0.45, `rgba(255, 80, 140, ${0.22 * intensity})`);
      core.addColorStop(0.72, `rgba(120, 60, 220, ${0.12 * intensity})`);
      core.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "soft-light";
      const wash = ctx.createLinearGradient(0, 0, w, h);
      wash.addColorStop(0, `rgba(255, 120, 80, ${0.12 * intensity})`);
      wash.addColorStop(0.5, `rgba(180, 80, 255, ${0.08 * intensity})`);
      wash.addColorStop(1, `rgba(80, 160, 255, ${0.1 * intensity})`);
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      drawEdges(w, h, pulse, intensity);

      ctx.globalCompositeOperation = "source-over";
      const vignette = ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.2,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.72
      );
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, `rgba(0, 0, 0, ${dimmed ? 0.55 : 0.38})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (visible) raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [visible, dimmed]);

  return (
    <canvas
      ref={canvasRef}
      className="image-forge-canvas"
      aria-hidden
    />
  );
}
