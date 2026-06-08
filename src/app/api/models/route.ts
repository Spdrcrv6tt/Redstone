import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ollamaHost =
    req.headers.get("x-ollama-host") ||
    process.env.OLLAMA_HOST ||
    "http://localhost:11434";

  try {
    const upstream = await fetch(`${ollamaHost}/api/tags`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new NextResponse(text, { status: upstream.status });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
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
