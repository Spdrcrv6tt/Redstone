import { NextRequest, NextResponse } from "next/server";
import { getAuthSecretOrNull } from "@/lib/auth/secret";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_API = new Set(["/api/auth/login"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_API.has(pathname)) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = getAuthSecretOrNull();

  if (pathname === "/login") {
    if (secret) {
      const token = req.cookies.get(SESSION_COOKIE)?.value;
      if (token) {
        const session = await verifySessionToken(token, secret);
        if (session) {
          return NextResponse.redirect(new URL("/", req.url));
        }
      }
    }
    return NextResponse.next();
  }

  if (PUBLIC_API.has(pathname)) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!secret) {
    return new NextResponse("Authentication is not configured on this server.", {
      status: 503,
    });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return redirectToLogin(req);
  }

  const session = await verifySessionToken(token, secret);
  if (!session) {
    const res = redirectToLogin(req);
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest): NextResponse {
  const login = new URL("/login", req.url);
  const from = req.nextUrl.pathname + req.nextUrl.search;
  if (from && from !== "/") {
    login.searchParams.set("from", from);
  }
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
