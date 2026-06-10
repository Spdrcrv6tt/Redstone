import { scryptSync, timingSafeEqual } from "crypto";
import {
  AUTH_PASSWORD_SALT,
  DEFAULT_AUTH_USER,
  DEFAULT_PASSWORD_HASH_B64,
} from "@/lib/auth/constants";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function expectedPasswordHash(): Buffer {
  const fromEnv = process.env.REDSTONE_AUTH_PASSWORD_HASH?.trim();
  if (fromEnv) return Buffer.from(fromEnv, "base64");
  return Buffer.from(DEFAULT_PASSWORD_HASH_B64, "base64");
}

function passwordSalt(): string {
  return process.env.REDSTONE_AUTH_PASSWORD_SALT?.trim() || AUTH_PASSWORD_SALT;
}

export function expectedUsername(): string {
  return process.env.REDSTONE_AUTH_USER?.trim() || DEFAULT_AUTH_USER;
}

export function verifyCredentials(username: string, password: string): boolean {
  if (!username || !password) return false;
  if (!safeEqual(username, expectedUsername())) return false;

  const derived = scryptSync(password, passwordSalt(), 32);
  const expected = expectedPasswordHash();
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
