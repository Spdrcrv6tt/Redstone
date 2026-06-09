import type { OllamaModel, OllamaTagsResponse } from "@/types";
import { upstreamHeaders } from "@/lib/proxy";

const DEFAULT_HOST = "http://localhost:11434";
const FETCH_TIMEOUT_MS = 8000;

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

export function isRemoteOllamaUrl(host: string): boolean {
  try {
    const { hostname, protocol } = new URL(host);
    if (isLocalHostname(hostname)) return false;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return !host.includes("127.0.0.1") && !host.includes("localhost");
  }
}

export function isBrowserLoopbackHost(host: string): boolean {
  try {
    return isLocalHostname(new URL(host).hostname);
  } catch {
    return host.includes("127.0.0.1") || host.includes("localhost");
  }
}

/** Hosts to query when building the model list (union of all successful responses). */
export function buildOllamaHostCandidates(clientHost?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw?: string | null) => {
    if (!raw?.trim()) return;
    const h = normalizeHost(raw.trim());
    if (seen.has(h)) return;
    seen.add(h);
    out.push(h);
  };

  add(process.env.OLLAMA_HOST);
  add(clientHost);

  const primary = clientHost?.trim() ? normalizeHost(clientHost.trim()) : "";
  if (!primary || isRemoteOllamaUrl(primary)) {
    add("http://127.0.0.1:11434");
    add("http://localhost:11434");
  }

  if (out.length === 0) out.push(DEFAULT_HOST);
  return out;
}

async function fetchTagsFromHost(
  host: string,
  apiKey: string
): Promise<OllamaModel[]> {
  const res = await fetch(`${host}/api/tags`, {
    method: "GET",
    headers: upstreamHeaders(apiKey),
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as OllamaTagsResponse;
  return Array.isArray(data.models) ? data.models : [];
}

/**
 * Query every candidate Ollama host in parallel and merge by model name.
 * Early Redstone listed models via direct browser → Ollama; the proxy later
 * only hit one host (often the tunnel) and dropped models that lived locally.
 */
export async function fetchMergedModelList(
  clientHost: string,
  apiKey: string
): Promise<{ models: OllamaModel[]; sources: string[] }> {
  const hosts = buildOllamaHostCandidates(clientHost);
  const byName = new Map<string, OllamaModel>();
  const sources: string[] = [];

  const results = await Promise.all(
    hosts.map(async (host) => {
      try {
        const models = await fetchTagsFromHost(host, apiKey);
        return { host, models };
      } catch {
        return { host, models: [] as OllamaModel[] };
      }
    })
  );

  for (const { host, models } of results) {
    if (models.length === 0) continue;
    sources.push(host);
    for (const model of models) {
      if (model?.name) byName.set(model.name, model);
    }
  }

  const models = [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return { models, sources };
}
