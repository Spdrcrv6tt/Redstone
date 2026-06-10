"use client";

import { useEffect, useRef } from "react";
import { usePageVisible } from "@/hooks/usePageVisible";

/** Saturated RGB primary-field animation for image generation loading. */
export function ImageForgeCanvas({
  dimmed = false,
  onAccentColor,
}: {
  dimmed?: boolean;
  onAccentColor?: (color: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onAccentRef = useRef(onAccentColor);
  onAccentRef.current = onAccentColor;
  const visible = usePageVisible();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const sampleBorderColor = (w: number, h: number): string => {
      const dpr = canvas.width / w;
      const points: [number, number][] = [
        [w / 2, 3],
        [w - 4, h / 2],
        [w / 2, h - 4],
        [3, h / 2],
      ];
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (const [x, y] of points) {
        const d = ctx.getImageData(
          Math.floor(x * dpr),
          Math.floor(y * dpr),
          1,
          1
        ).data;
        if (d[0] + d[1] + d[2] > 24) {
          r += d[0];
          g += d[1];
          b += d[2];
          n++;
        }
      }
      if (!n) return "rgb(255, 0, 0)";
      return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
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
      const intensity = dimmed ? 0.5 : 1;

      ctx.fillStyle = "#040408";
      ctx.fillRect(0, 0, w, h);

      const blobs = [
        {
          x: 0.3 + Math.sin(t * 0.55) * 0.16,
          y: 0.42 + Math.cos(t * 0.48) * 0.12,
          r: 0.58,
          hue: 0,
          a: 0.92,
        },
        {
          x: 0.68 + Math.cos(t * 0.62) * 0.14,
          y: 0.38 + Math.sin(t * 0.51) * 0.11,
          r: 0.54,
          hue: 120,
          a: 0.88,
        },
        {
          x: 0.5 + Math.sin(t * 0.44) * 0.18,
          y: 0.62 + Math.cos(t * 0.39) * 0.1,
          r: 0.52,
          hue: 240,
          a: 0.9,
        },
        {
          x: 0.42 + Math.cos(t * 0.7) * 0.12,
          y: 0.28 + Math.sin(t * 0.58) * 0.09,
          r: 0.42,
          hue: 60,
          a: 0.75,
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
        grd.addColorStop(0, `hsla(${b.hue}, 100%, 52%, ${b.a * intensity})`);
        grd.addColorStop(0.35, `hsla(${b.hue}, 100%, 48%, ${b.a * 0.65 * intensity})`);
        grd.addColorStop(0.7, `hsla(${b.hue}, 95%, 42%, ${b.a * 0.28 * intensity})`);
        grd.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalCompositeOperation = "source-over";
      const vignette = ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.25,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.78
      );
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, `rgba(0, 0, 0, ${dimmed ? 0.35 : 0.18})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      frame++;
      if (frame % 2 === 0 && onAccentRef.current) {
        onAccentRef.current(sampleBorderColor(w, h));
      }

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
