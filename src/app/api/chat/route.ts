import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const ollamaHost =
    req.headers.get("x-ollama-host") ||
    process.env.OLLAMA_HOST ||
    "http://localhost:11434";

  const apiKey =
    req.headers.get("x-ollama-api-key") ||
    process.env.OLLAMA_API_KEY ||
    "";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const upstreamUrl = `${ollamaHost}/api/chat`;
  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) upstreamHeaders["Authorization"] = `Bearer ${apiKey}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      // Try to preserve Ollama's JSON error, otherwise wrap it
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
