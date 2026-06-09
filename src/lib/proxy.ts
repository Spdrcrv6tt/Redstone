import { NextRequest } from "next/server";

export interface ProxyConfig {
  host: string;
  apiKey: string;
}

const DEFAULT_HOST = "http://localhost:11434";

/** Read host/key from JSON body (_host / _apiKey fields). */
export function configFromBody(body: Record<string, unknown>): ProxyConfig {
  const { _host, _apiKey } = body as { _host?: string; _apiKey?: string };
  return {
    host:
      (typeof _host === "string" && _host) ||
      process.env.OLLAMA_HOST ||
      DEFAULT_HOST,
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
    host: host || process.env.OLLAMA_HOST || DEFAULT_HOST,
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
