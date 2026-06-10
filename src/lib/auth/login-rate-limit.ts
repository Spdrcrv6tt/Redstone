const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

interface Entry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

const attempts = new Map<string, Entry>();

function prune(now: number) {
  if (attempts.size < 500) return;
  for (const [key, entry] of attempts) {
    if (entry.lockedUntil < now && now - entry.windowStart > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export function loginRateLimitKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function isLoginBlocked(key: string): boolean {
  const now = Date.now();
  prune(now);
  const entry = attempts.get(key);
  return Boolean(entry && entry.lockedUntil > now);
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  prune(now);
  const entry = attempts.get(key) ?? {
    failures: 0,
    windowStart: now,
    lockedUntil: 0,
  };

  if (now - entry.windowStart > WINDOW_MS) {
    entry.failures = 0;
    entry.windowStart = now;
    entry.lockedUntil = 0;
  }

  entry.failures += 1;
  if (entry.failures >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + WINDOW_MS;
  }
  attempts.set(key, entry);
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
