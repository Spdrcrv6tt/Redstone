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

async function fetchTags(
  clientHost: string,
  localHost: string,
  apiKey: string
) {
  const { models, sources } = await fetchMergedModelList(clientHost, localHost, apiKey);

  if (models.length === 0) {
    return NextResponse.json(
      { error: `No models found. Attempted: ${sources.join(", ") || clientHost}` },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { models },
    {
      headers: {
        "X-Redstone-Model-Count": String(models.length),
        "X-Redstone-Sources": sources.join(", "),
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const { host, apiKey } = configFromSearch(req);
  try {
    return await fetchTags(host, "http://127.0.0.1:11434", apiKey);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { host, apiKey } = configFromBody(body);
  const localHost =
    typeof body._localHost === "string" && body._localHost.trim()
      ? body._localHost.trim()
      : "http://127.0.0.1:11434";

  try {
    return await fetchTags(host, localHost, apiKey);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
