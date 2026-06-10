import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COMFYUI_URL =
  process.env.COMFYUI_URL?.trim() || "http://127.0.0.1:8188";

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const filename = req.nextUrl.searchParams.get("filename");
  if (!filename || /[\\/]/.test(filename)) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const type = req.nextUrl.searchParams.get("type") || "output";
  const subfolder = req.nextUrl.searchParams.get("subfolder") || "";

  const viewUrl = new URL("/view", COMFYUI_URL);
  viewUrl.searchParams.set("filename", filename);
  viewUrl.searchParams.set("type", type);
  if (subfolder) viewUrl.searchParams.set("subfolder", subfolder);

  try {
    const upstream = await fetch(viewUrl.toString());
    if (!upstream.ok) {
      return new NextResponse("ComfyUI fetch failed", { status: 502 });
    }

    const buffer = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get("content-type") || "image/png";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("ComfyUI unreachable", { status: 502 });
  }
}
