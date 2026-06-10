import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  configFromBody,
  upstreamHeaders,
  CORS_HEADERS,
} from "@/lib/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { host, apiKey } = configFromBody(body);
  const { _host: _, _apiKey: __, ...ollamaBody } = body as {
    _host?: string;
    _apiKey?: string;
    [key: string]: unknown;
  };

  if (!ollamaBody.model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: upstreamHeaders(apiKey),
      body: JSON.stringify(ollamaBody),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let errorBody: object;
      try {
        errorBody = JSON.parse(text);
      } catch {
        errorBody = {
          error: `Ollama ${upstream.status}: ${text.slice(0, 300) || upstream.statusText}`,
        };
      }
      return NextResponse.json(errorBody, { status: upstream.status });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isConnRefused =
      message.includes("ECONNREFUSED") || message.includes("fetch failed");
    return NextResponse.json(
      {
        error: isConnRefused
          ? `Cannot reach Ollama at ${host}. Is it running?`
          : message,
      },
      { status: 502 }
    );
  }
}
