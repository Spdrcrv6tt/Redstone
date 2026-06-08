import type {
  OllamaTagsResponse,
  OllamaChatRequest,
  OllamaChatResponseChunk,
} from "@/types";

export function getOllamaHost(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ollama_host") || "http://localhost:11434";
  }
  return process.env.OLLAMA_HOST || "http://localhost:11434";
}

export async function fetchModels(host: string): Promise<OllamaTagsResponse> {
  const res = await fetch(`${host}/api/tags`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`);
  return res.json();
}

export async function* streamChat(
  host: string,
  request: OllamaChatRequest,
  signal?: AbortSignal
): AsyncGenerator<OllamaChatResponseChunk> {
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, stream: true }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
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
