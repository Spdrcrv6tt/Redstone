import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/auth/credentials";
import {
  clearLoginFailures,
  isLoginBlocked,
  loginRateLimitKey,
  recordLoginFailure,
} from "@/lib/auth/login-rate-limit";
import { getAuthSecret } from "@/lib/auth/secret";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rateKey = loginRateLimitKey(req);
  if (isLoginBlocked(rateKey)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!verifyCredentials(username, password)) {
    recordLoginFailure(rateKey);
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  clearLoginFailures(rateKey);

  let token: string;
  try {
    token = await createSessionToken(username, getAuthSecret());
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Authentication is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
