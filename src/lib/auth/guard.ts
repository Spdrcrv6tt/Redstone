import { NextRequest, NextResponse } from "next/server";
import { getAuthSecret } from "@/lib/auth/secret";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function requireAuth(
  req: NextRequest
): Promise<NextResponse | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await verifySessionToken(token, getAuthSecret());
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
