import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CANDIDATES = [
  "http://127.0.0.1:11434",
  "http://localhost:11434",
  "http://0.0.0.0:11434",
  "http://127.0.0.1:11435",
  "https://ollama.deoxylabs.com",
];

async function tryHost(host: string, apiKey: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  try {
    const res = await fetch(`${host}/api/tags`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: res.status, error: `HTTP ${res.status}`, models: [], count: 0 };
    const data = (await res.json()) as { models?: { name: string }[] };
    const models = (data.models ?? []).map((m) => m.name);
    return { status: 200, models, count: models.length };
  } catch (e) {
    return { status: 0, error: String(e), models: [], count: 0 };
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const apiKey = process.env.OLLAMA_API_KEY ?? "";
  const envHost = process.env.OLLAMA_HOST ?? "(not set)";

  const results: Record<string, unknown> = {};
  await Promise.all(
    CANDIDATES.map(async (host) => {
      results[host] = await tryHost(host, apiKey);
    })
  );

  const totalUnique = new Set(
    Object.values(results)
      .flatMap((r) => ((r as { models?: string[] }).models ?? []))
  ).size;

  return NextResponse.json({
    env: {
      OLLAMA_HOST: envHost,
      OLLAMA_API_KEY: apiKey ? `set (${apiKey.length} chars)` : "not set",
      NODE_ENV: process.env.NODE_ENV,
    },
    totalUniqueModels: totalUnique,
    results,
  });
}
