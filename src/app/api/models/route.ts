import { NextRequest, NextResponse } from "next/server";
import {
  configFromBody,
  configFromSearch,
  CORS_HEADERS,
} from "@/lib/proxy";
import { fetchMergedModelList } from "@/lib/ollama-hosts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function fetchTags(clientHost: string, apiKey: string) {
  const { models, sources } = await fetchMergedModelList(clientHost, apiKey);

  if (models.length === 0) {
    return NextResponse.json(
      {
        error: `No models found. Tried: ${sources.join(", ") || clientHost}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { models },
    {
      headers: {
        "X-Redstone-Model-Count": String(models.length),
        "X-Redstone-Ollama-Sources": sources.join(","),
      },
    }
  );
}

/** Legacy GET via query params — no custom headers needed. */
export async function GET(req: NextRequest) {
  const { host, apiKey } = configFromSearch(req);
  try {
    return await fetchTags(host, apiKey);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
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
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
