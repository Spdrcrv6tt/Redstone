import { NextRequest, NextResponse } from "next/server";

// Handle CORS preflight — browsers send OPTIONS before POST when
// non-standard headers are present.
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Pull proxy config out of the body; the rest is forwarded to Ollama.
  const { _host, _apiKey, ...ollamaBody } = body as {
    _host?: string;
    _apiKey?: string;
    [key: string]: unknown;
  };

  const ollamaHost =
    _host ||
    process.env.OLLAMA_HOST ||
    "http://localhost:11434";

  const apiKey =
    _apiKey ||
    process.env.OLLAMA_API_KEY ||
    "";

  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) upstreamHeaders["Authorization"] = `Bearer ${apiKey}`;

  try {
    const upstream = await fetch(`${ollamaHost}/api/chat`, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(ollamaBody),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let errorBody: object;
      try {
        errorBody = JSON.parse(text);
      } catch {
        errorBody = { error: `Ollama ${upstream.status}: ${text.slice(0, 300) || upstream.statusText}` };
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
          ? `Cannot reach Ollama at ${ollamaHost}. Is it running?`
          : message,
      },
      { status: 502 }
    );
  }
}
