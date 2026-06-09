import { NextRequest, NextResponse } from "next/server";
import {
  configFromBodyAsync,
  configFromSearchAsync,
  upstreamHeaders,
  CORS_HEADERS,
} from "@/lib/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

async function fetchTags(host: string, apiKey: string) {
  const upstream = await fetch(`${host}/api/tags`, {
    method: "GET",
    headers: {
      ...upstreamHeaders(apiKey),
      ...NO_CACHE,
    },
    cache: "no-store",
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
    return NextResponse.json(errorBody, {
      status: upstream.status,
      headers: NO_CACHE,
    });
  }

  const data = await upstream.json();
  const models = Array.isArray((data as { models?: unknown }).models)
    ? (data as { models: unknown[] }).models
    : [];

  return NextResponse.json(data, {
    headers: {
      ...NO_CACHE,
      "X-Redstone-Model-Count": String(models.length),
      "X-Redstone-Ollama-Host": host,
    },
  });
}

/** Legacy GET via query params — no custom headers needed. */
export async function GET(req: NextRequest) {
  const { host, apiKey } = await configFromSearchAsync(req);
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

  const { host, apiKey } = await configFromBodyAsync(body);

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
