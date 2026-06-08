import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) upstreamHeaders["Authorization"] = `Bearer ${apiKey}`;

  try {
    const upstream = await fetch(`${ollamaHost}/api/chat`, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(body),
      // @ts-expect-error - Node 18+ fetch supports duplex for streaming
      duplex: "half",
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new NextResponse(text, { status: upstream.status });
    }

    // Stream the response back to the client
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
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
