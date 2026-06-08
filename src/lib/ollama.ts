import type {
  OllamaTagsResponse,
  OllamaChatRequest,
  OllamaChatResponseChunk,
} from "@/types";

/**
 * All Ollama traffic is routed through Next.js API proxy routes.
 * This avoids CORS entirely — the browser only ever talks to the same-origin
 * Next.js server, which then forwards to whatever host is configured.
 * The Ollama host is passed via the x-ollama-host header.
 */

function buildHeaders(host: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "x-ollama-host": host };
  if (apiKey) headers["x-ollama-api-key"] = apiKey;
  return headers;
}

export async function fetchModels(host: string, apiKey = ""): Promise<OllamaTagsResponse> {
  const res = await fetch("/api/models", {
    headers: buildHeaders(host, apiKey),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch models: ${res.statusText}`);
  }
  return res.json();
}

export async function* streamChat(
  host: string,
  request: OllamaChatRequest,
  signal?: AbortSignal,
  apiKey = ""
): AsyncGenerator<OllamaChatResponseChunk> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(host, apiKey),
    },
    body: JSON.stringify({ ...request, stream: true }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Ollama error ${res.status}: ${res.statusText}`);
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk: OllamaChatResponseChunk = JSON.parse(trimmed);
          yield chunk;
          if (chunk.done) return;
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function generateTitle(firstUserMessage: string): string {
  const truncated = firstUserMessage.slice(0, 60).trim();
  return truncated.length < firstUserMessage.length
    ? `${truncated}…`
    : truncated;
}
