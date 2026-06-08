import type {
  OllamaTagsResponse,
  OllamaChatRequest,
  OllamaChatResponseChunk,
} from "@/types";

/**
 * All Ollama traffic goes through the Next.js proxy routes.
 * For the chat route, host/key are embedded in the JSON body so the
 * browser never needs to send custom headers — this avoids CORS
 * preflight (OPTIONS) requests that would 405 if not handled.
 * The models route still uses headers because it's a GET (no body).
 */

export async function fetchModels(host: string, apiKey = ""): Promise<OllamaTagsResponse> {
  const headers: Record<string, string> = { "x-ollama-host": host };
  if (apiKey) headers["x-ollama-api-key"] = apiKey;

  const res = await fetch("/api/models", { headers });
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      stream: true,
      _host: host,
      ...(apiKey ? { _apiKey: apiKey } : {}),
    }),
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
