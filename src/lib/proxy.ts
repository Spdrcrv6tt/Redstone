import { NextRequest } from "next/server";

export interface ProxyConfig {
  host: string;
  apiKey: string;
}

const DEFAULT_HOST = "http://localhost:11434";
const LOCAL_PROBE_MS = 1500;
const LOCAL_HOST_CACHE_MS = 60_000;

const LOCAL_CANDIDATES = [
  () => process.env.OLLAMA_HOST?.trim(),
  () => "http://127.0.0.1:11434",
  () => "http://localhost:11434",
] as const;

let localHostCache: { host: string; expires: number } | null = null;

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

/** True when the URL points at a remote/tunnel Ollama, not same-machine loopback. */
export function isRemoteOllamaUrl(host: string): boolean {
  try {
    const { hostname, protocol } = new URL(host);
    if (isLocalHostname(hostname)) return false;
    // LAN IPs are still "remote" from the browser's tunnel settings perspective.
    return protocol === "http:" || protocol === "https:";
  } catch {
    return !host.includes("127.0.0.1") && !host.includes("localhost");
  }
}

async function probeOllama(host: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${normalizeHost(host)}/api/tags`, {
      method: "GET",
      headers: upstreamHeaders(apiKey),
      cache: "no-store",
      signal: AbortSignal.timeout(LOCAL_PROBE_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function discoverLocalOllamaHost(apiKey: string): Promise<string | null> {
  if (localHostCache && localHostCache.expires > Date.now()) {
    return localHostCache.host;
  }

  for (const candidate of LOCAL_CANDIDATES) {
    const host = candidate()?.trim();
    if (!host) continue;
    const normalized = normalizeHost(host);
    if (await probeOllama(normalized, apiKey)) {
      localHostCache = {
        host: normalized,
        expires: Date.now() + LOCAL_HOST_CACHE_MS,
      };
      return normalized;
    }
  }

  return null;
}

/**
 * Pick the upstream Ollama host for server-side proxy routes.
 *
 * Priority:
 * 1. OLLAMA_HOST env (unless OLLAMA_ALLOW_CLIENT_HOST=true)
 * 2. Local Ollama on this machine when the browser sends a tunnel/public URL
 * 3. Browser settings host
 */
export async function resolveUpstreamHostAsync(
  clientHost?: string | null,
  apiKey = ""
): Promise<string> {
  const envHost = process.env.OLLAMA_HOST?.trim();
  const allowClientOverride = process.env.OLLAMA_ALLOW_CLIENT_HOST === "true";
  const fromClient =
    typeof clientHost === "string" && clientHost.trim()
      ? normalizeHost(clientHost.trim())
      : "";

  if (envHost && !allowClientOverride) {
    return normalizeHost(envHost);
  }

  const fallback = fromClient || (envHost ? normalizeHost(envHost) : DEFAULT_HOST);

  if (isRemoteOllamaUrl(fallback)) {
    const local = await discoverLocalOllamaHost(apiKey);
    if (local) return local;
  }

  return fallback;
}

/** Sync resolver — env or client only; no localhost probe. */
export function resolveUpstreamHost(clientHost?: string | null): string {
  const envHost = process.env.OLLAMA_HOST?.trim();
  const allowClientOverride = process.env.OLLAMA_ALLOW_CLIENT_HOST === "true";
  const fromClient =
    typeof clientHost === "string" && clientHost.trim()
      ? normalizeHost(clientHost.trim())
      : "";

  if (envHost && !allowClientOverride) {
    return normalizeHost(envHost);
  }

  return fromClient || (envHost ? normalizeHost(envHost) : DEFAULT_HOST);
}

/** Read host/key from JSON body (_host / _apiKey fields). */
export async function configFromBodyAsync(
  body: Record<string, unknown>
): Promise<ProxyConfig> {
  const { _host, _apiKey } = body as { _host?: string; _apiKey?: string };
  const apiKey =
    (typeof _apiKey === "string" && _apiKey) ||
    process.env.OLLAMA_API_KEY ||
    "";

  return {
    host: await resolveUpstreamHostAsync(_host, apiKey),
    apiKey,
  };
}

/** Read host/key from JSON body (_host / _apiKey fields). */
export function configFromBody(body: Record<string, unknown>): ProxyConfig {
  const { _host, _apiKey } = body as { _host?: string; _apiKey?: string };
  return {
    host: resolveUpstreamHost(_host),
    apiKey:
      (typeof _apiKey === "string" && _apiKey) ||
      process.env.OLLAMA_API_KEY ||
      "",
  };
}

/** Read host/key from URL search params (no custom headers). */
export async function configFromSearchAsync(
  req: NextRequest
): Promise<ProxyConfig> {
  const host = req.nextUrl.searchParams.get("host");
  const apiKey = req.nextUrl.searchParams.get("apiKey");
  return {
    host: await resolveUpstreamHostAsync(
      host,
      apiKey || process.env.OLLAMA_API_KEY || ""
    ),
    apiKey: apiKey || process.env.OLLAMA_API_KEY || "",
  };
}

/** Read host/key from URL search params (no custom headers). */
export function configFromSearch(req: NextRequest): ProxyConfig {
  const host = req.nextUrl.searchParams.get("host");
  const apiKey = req.nextUrl.searchParams.get("apiKey");
  return {
    host: resolveUpstreamHost(host),
    apiKey: apiKey || process.env.OLLAMA_API_KEY || "",
  };
}

export function upstreamHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;
