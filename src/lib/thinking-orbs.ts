import type { ThinkingOrbPath, ThinkingOrbSettings } from "@/types";

export const THINKING_ORB_MIN = 1;
export const THINKING_ORB_MAX = 8;

export const DEFAULT_THINKING_ORBS: ThinkingOrbSettings = {
  count: 3,
  speed: 2.2,
  radius: 9,
  path: "circular",
  colors: ["#ff0000", "#00ff00", "#0000ff"],
};

const FALLBACK_COLORS = [
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ff0000",
  "#0000ff",
];

export function normalizeThinkingOrbs(
  raw?: Partial<ThinkingOrbSettings>
): ThinkingOrbSettings {
  const count = Math.min(
    THINKING_ORB_MAX,
    Math.max(THINKING_ORB_MIN, Math.round(raw?.count ?? DEFAULT_THINKING_ORBS.count))
  );
  const colors = ensureOrbColors(raw?.colors, count);
  return {
    count,
    speed: Math.min(6, Math.max(0.2, raw?.speed ?? DEFAULT_THINKING_ORBS.speed)),
    radius: Math.min(18, Math.max(4, raw?.radius ?? DEFAULT_THINKING_ORBS.radius)),
    path: raw?.path ?? DEFAULT_THINKING_ORBS.path,
    colors,
  };
}

export function ensureOrbColors(colors: string[] | undefined, count: number): string[] {
  const next = [...(colors ?? DEFAULT_THINKING_ORBS.colors)];
  while (next.length < count) {
    next.push(FALLBACK_COLORS[next.length % FALLBACK_COLORS.length]);
  }
  return next.slice(0, count);
}

function triangleVertices(radius: number) {
  return [
    { x: 0, y: -radius },
    {
      x: radius * Math.cos(Math.PI / 6),
      y: radius * Math.sin(Math.PI / 6),
    },
    {
      x: -radius * Math.cos(Math.PI / 6),
      y: radius * Math.sin(Math.PI / 6),
    },
  ];
}

function pointOnTriangle(progress: number, radius: number) {
  const verts = triangleVertices(radius);
  const seg = (progress % 1) * 3;
  const i = Math.floor(seg) % 3;
  const f = seg - Math.floor(seg);
  const a = verts[i];
  const b = verts[(i + 1) % 3];
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
  };
}

/** Parametric orbit position — fixed scale, no opacity tricks. */
export function thinkingOrbPosition(
  t: number,
  index: number,
  cfg: ThinkingOrbSettings
): { x: number; y: number } {
  const { count, speed, radius, path } = cfg;
  const phase = (index / count) * Math.PI * 2;

  switch (path) {
    case "triangular": {
      const progress = t * speed * 0.35 + index / count;
      return pointOnTriangle(progress, radius);
    }
    case "atom": {
      const tilt = (index / count) * Math.PI;
      const angle = t * speed + phase;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * Math.cos(tilt);
      const z = Math.sin(angle) * radius * Math.sin(tilt);
      return { x, y: y + z * 0.4 };
    }
    case "star4": {
      const angle = t * speed + phase;
      const r = radius * (0.38 + 0.62 * Math.abs(Math.cos(2 * angle)));
      return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    }
    case "circular":
    default: {
      const angle = t * speed + phase;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }
  }
}

export const THINKING_ORB_PATH_LABELS: Record<
  ThinkingOrbPath,
  string
> = {
  circular: "Circle",
  triangular: "Triangle",
  atom: "Atom orbit",
  star4: "4-point star",
};
