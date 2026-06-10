import { NextRequest, NextResponse } from "next/server";
import {
  configFromBody,
  upstreamHeaders,
  CORS_HEADERS,
} from "@/lib/proxy";
import { stripBuilderHtmlFences } from "@/lib/widget";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUILDER_SYSTEM = `You are an expert frontend developer.
Generate a single-file, interactive HTML document using vanilla HTML, CSS, and JS based on the user's specification.
- Use CDN links for libraries like TailwindCSS, D3.js, Chart.js, or Anime.js if helpful.
- Use a dark theme (#0f1117 background, light text).
- Return ONLY the raw HTML code. No markdown formatting, no \`\`\`html code blocks. Start immediately with <!DOCTYPE html>.

LAYOUT (required — everything must fit on screen at once, no page scroll):
- Set html, body { height: 100%; margin: 0; overflow: hidden; } and body { display: flex; flex-direction: column; min-height: 100vh; max-height: 100vh; box-sizing: border-box; }.
- Put the main visualization in a dedicated container (class="canvas" or data-widget-canvas) with flex-grow: 1, flex: 1 1 auto, min-height: 50vh, min-height: 0, width: 100%, and overflow: hidden (scale or letterbox inside if needed).
- Keep control panels, legends, and data readouts compact: flex: 0 0 auto, small padding (0.5rem), font-size 0.75rem–0.875rem, single tight rows where possible.
- Do not rely on vertical page scrolling; fit all UI within the viewport height.`;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const spec = typeof body.spec === "string" ? body.spec.trim() : "";
  if (!spec) {
    return NextResponse.json({ error: "spec is required" }, { status: 400 });
  }

  const model =
    (typeof body.model === "string" && body.model) ||
    (typeof body.widgetModel === "string" && body.widgetModel) ||
    undefined;

  if (!model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  const { host, apiKey } = configFromBody(body);

  try {
    const upstream = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: upstreamHeaders(apiKey),
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: BUILDER_SYSTEM },
          { role: "user", content: spec },
        ],
        options: {
          temperature: 0.35,
          num_predict: 8192,
        },
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(
        {
          error: text.slice(0, 400) || `Ollama ${upstream.status}`,
        },
        { status: upstream.status }
      );
    }

    const data = (await upstream.json()) as {
      message?: { content?: string };
    };

    const raw = data.message?.content?.trim() ?? "";
    if (!raw) {
      return NextResponse.json(
        { error: "Builder returned empty HTML" },
        { status: 502 }
      );
    }

    const html = stripBuilderHtmlFences(raw);
    return NextResponse.json({ html });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Widget build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
