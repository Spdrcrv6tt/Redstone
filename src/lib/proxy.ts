import { NextRequest } from "next/server";

export interface ProxyConfig {
  /** Upstream Ollama URL — always loopback on the server. */
  host: string;
  apiKey: string;
}

/** Server-side Ollama — never hairpin through the public tunnel. */
export const SERVER_OLLAMA_HOST =
  process.env.OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";

const LOOPBACK_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "0.0.0.0",
  "::1",
]);

function normalizeHost(url: string): string {
  return url.replace(/\/+$/, "");
}

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

/** True when the URL points at a remote/tunnel Ollama endpoint. */
export function isRemoteOllamaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !isLoopbackHost(host);
  } catch {
    return false;
  }
}

/**
 * Resolve the Ollama host for server-side upstream fetches.
 * Always uses local loopback — Cloudflare tunnel is for external clients only.
 */
export function resolveServerOllamaHost(_clientHost?: string): string {
  const env = process.env.OLLAMA_HOST?.trim();
  if (env) return normalizeHost(env);
  return normalizeHost(SERVER_OLLAMA_HOST);
}

/** Read host/key from JSON body (_host / _apiKey fields). */
export function configFromBody(body: Record<string, unknown>): ProxyConfig {
  const { _host, _apiKey } = body as { _host?: string; _apiKey?: string };
  const clientHost =
    typeof _host === "string" && _host ? _host : undefined;

  return {
    host: resolveServerOllamaHost(clientHost),
    apiKey:
      (typeof _apiKey === "string" && _apiKey) ||
      process.env.OLLAMA_API_KEY ||
      "",
  };
}

/** Read host/key from URL search params (no custom headers). */
export function configFromSearch(req: NextRequest): ProxyConfig {
  const host = req.nextUrl.searchParams.get("host");
  const apiKey = req.nextUrl.searchParams.get("apiKey");
  return {
    host: resolveServerOllamaHost(host ?? undefined),
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
