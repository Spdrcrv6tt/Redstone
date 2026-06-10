const DEV_FALLBACK =
  "redstone-dev-secret-do-not-use-in-production-32";

export function getAuthSecret(): string {
  const secret = process.env.REDSTONE_AUTH_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "REDSTONE_AUTH_SECRET must be set to a random string of at least 32 characters."
    );
  }

  return DEV_FALLBACK;
}

/** Edge/middleware-safe; returns null when production secret is missing. */
export function getAuthSecretOrNull(): string | null {
  const secret = process.env.REDSTONE_AUTH_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") return null;
  return DEV_FALLBACK;
}
