import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  fetchRemoteImage,
  isAllowedRemoteImageUrl,
} from "@/lib/image-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw || !isAllowedRemoteImageUrl(raw)) {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  const result = await fetchRemoteImage(raw);
  if (!result) {
    return new NextResponse("Fetch failed", { status: 502 });
  }

  if (result.buffer.byteLength > MAX_BYTES) {
    return new NextResponse("Image too large", { status: 413 });
  }

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
