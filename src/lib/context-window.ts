export const DEFAULT_NUM_CTX = 16384;
export const MIN_NUM_CTX = 2048;
export const MAX_NUM_CTX = 262144;

export const NUM_CTX_PRESETS = [
  4096, 8192, 16384, 32768, 65536, 131072,
] as const;

export function normalizeNumCtx(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_NUM_CTX;
  return Math.min(MAX_NUM_CTX, Math.max(MIN_NUM_CTX, Math.round(n)));
}

export function formatNumCtx(n: number): string {
  if (n >= 1024 && n % 1024 === 0) return `${n / 1024}K`;
  return n.toLocaleString();
}
