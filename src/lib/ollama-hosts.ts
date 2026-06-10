import type { OllamaModel, OllamaTagsResponse } from "@/types";

const FETCH_TIMEOUT_MS = 8000;

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

function upstreamHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

async function fetchTagsFromHost(
  host: string,
  apiKey: string
): Promise<OllamaModel[]> {
  try {
    const res = await fetch(`${host}/api/tags`, {
      method: "GET",
      headers: upstreamHeaders(apiKey),
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OllamaTagsResponse;
    return Array.isArray(data.models) ? data.models : [];
  } catch {
    return [];
  }
}

/**
 * Build the list of Ollama host candidates to query for models.
 *
 * Order of preference:
 * 1. OLLAMA_HOST env (if set on the server)
 * 2. localOllamaHost from settings (default: 127.0.0.1:11434)
 * 3. ollamaHost from settings (the tunnel or remote URL)
 *
 * All reachable hosts are queried in parallel and results are merged by model name.
 * This ensures that models on the local machine AND on the tunnel are all visible.
 */
export function buildOllamaHostCandidates(
  clientHost: string,
  localHost: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw?: string | null) => {
    if (!raw?.trim()) return;
    const h = normalizeHost(raw.trim());
    if (!h || seen.has(h)) return;
    seen.add(h);
    out.push(h);
  };

  // Server env always wins first
  add(process.env.OLLAMA_HOST);
  // Local Ollama (same machine as Next.js server) — this is where all the models live
  add(localHost);
  // Tunnel/remote host from browser settings
  add(clientHost);

  // Always include loopback candidates in case neither setting is a local address
  add("http://127.0.0.1:11434");
  add("http://localhost:11434");

  return out;
}

export async function fetchMergedModelList(
  clientHost: string,
  localHost: string,
  apiKey: string
): Promise<{ models: OllamaModel[]; sources: string[] }> {
  const hosts = buildOllamaHostCandidates(clientHost, localHost);
  const byName = new Map<string, OllamaModel>();
  const sources: string[] = [];

  const results = await Promise.all(
    hosts.map(async (host) => ({ host, models: await fetchTagsFromHost(host, apiKey) }))
  );

  for (const { host, models } of results) {
    if (models.length === 0) continue;
    sources.push(`${host}(${models.length})`);
    for (const model of models) {
      if (model?.name) byName.set(model.name, model);
    }
  }

  const models = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { models, sources };
}
