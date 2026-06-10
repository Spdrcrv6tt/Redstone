import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  SESSION_VERSION,
} from "@/lib/auth/constants";

export { SESSION_COOKIE, SESSION_MAX_AGE_SEC };

export interface SessionPayload {
  u: string;
  exp: number;
  iat: number;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  try {
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return bytesToBase64Url(new Uint8Array(sig));
}

async function hmacVerify(
  message: string,
  signatureB64: string,
  secret: string
): Promise<boolean> {
  const sigBytes = base64UrlToBytes(signatureB64);
  if (!sigBytes) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes.buffer.slice(
      sigBytes.byteOffset,
      sigBytes.byteOffset + sigBytes.byteLength
    ) as ArrayBuffer,
    new TextEncoder().encode(message)
  );
}

export async function createSessionToken(
  username: string,
  secret: string
): Promise<string> {
  const now = Date.now();
  const payload: SessionPayload = {
    u: username,
    iat: now,
    exp: now + SESSION_MAX_AGE_SEC * 1000,
  };
  const body = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const sig = await hmacSign(body, secret);
  return `${SESSION_VERSION}.${body}.${sig}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== SESSION_VERSION) return null;

  const [, body, sig] = parts;
  if (!body || !sig) return null;

  const valid = await hmacVerify(body, sig, secret);
  if (!valid) return null;

  const raw = base64UrlToBytes(body);
  if (!raw) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw)) as SessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.u !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number"
  ) {
    return null;
  }

  if (payload.exp <= Date.now()) return null;
  if (payload.iat > Date.now() + 60_000) return null;

  return payload;
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
