import { NextRequest, NextResponse } from "next/server";
import {
  configFromBody,
  configFromSearch,
  upstreamHeaders,
  CORS_HEADERS,
} from "@/lib/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function fetchTags(host: string, apiKey: string) {
  const upstream = await fetch(`${host}/api/tags`, {
    method: "GET",
    headers: upstreamHeaders(apiKey),
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

  const data = await upstream.json();
  return NextResponse.json(data);
}

/** Legacy GET via query params — no custom headers needed. */
export async function GET(req: NextRequest) {
  const { host, apiKey } = configFromSearch(req);
  try {
    return await fetchTags(host, apiKey);
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

/** Preferred: POST with _host / _apiKey in JSON body (matches /api/chat). */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { host, apiKey } = configFromBody(body);

  try {
    return await fetchTags(host, apiKey);
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
