import type {
  OllamaTagsResponse,
  OllamaChatRequest,
  OllamaChatResponseChunk,
  AgentStatusMeta,
  MessageSearchMeta,
  SearchMode,
} from "@/types";

/**
 * All Ollama traffic goes through Next.js proxy routes.
 * Host and API key travel in the JSON body — never as custom headers —
 * so browsers never trigger CORS preflight that can 405.
 */

function proxyBody(
  host: string,
  apiKey: string,
  extras?: {
    braveApiKey?: string;
    systemPrompt?: string;
    priorImageUrls?: string[];
    searchMode?: SearchMode;
    routerModel?: string;
    debugMode?: boolean;
  }
) {
  return {
    _host: host,
    ...(apiKey ? { _apiKey: apiKey } : {}),
    ...(extras?.braveApiKey ? { _braveApiKey: extras.braveApiKey } : {}),
    ...(extras?.systemPrompt !== undefined
      ? { _systemPrompt: extras.systemPrompt }
      : {}),
    ...(extras?.priorImageUrls?.length
      ? { _priorImageUrls: extras.priorImageUrls }
      : {}),
    ...(extras?.searchMode !== undefined
      ? { _searchMode: extras.searchMode }
      : {}),
    ...(extras?.routerModel !== undefined
      ? { _routerModel: extras.routerModel }
      : {}),
    ...(extras?.debugMode !== undefined ? { _debugMode: extras.debugMode } : {}),
  };
}

export type AgentStreamEvent =
  | { type: "status"; status: AgentStatusMeta }
  | { type: "meta"; meta: MessageSearchMeta }
  | { type: "chunk"; chunk: OllamaChatResponseChunk };

export interface FetchModelsResult extends OllamaTagsResponse {
  resolvedHost?: string;
  modelCount?: number;
}

export async function fetchModels(
  host: string,
  apiKey = ""
): Promise<FetchModelsResult> {
  const res = await fetch("/api/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proxyBody(host, apiKey)),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ||
        `Failed to fetch models: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as OllamaTagsResponse;
  const resolvedHost = res.headers.get("x-redstone-ollama-host") ?? undefined;
  const modelCountHeader = res.headers.get("x-redstone-model-count");
  const modelCount =
    modelCountHeader !== null
      ? Number(modelCountHeader)
      : data.models?.length;

  return { ...data, resolvedHost, modelCount };
}

/** Chat with automatic Brave web search (server-side, not tool-calling). */
export async function* streamAgent(
  host: string,
  request: OllamaChatRequest,
  signal?: AbortSignal,
  apiKey = "",
  braveApiKey = "",
  systemPrompt = "",
  priorImageUrls: string[] = [],
  searchMode: SearchMode = "auto",
  routerModel = "",
  debugMode = false
): AsyncGenerator<AgentStreamEvent> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      stream: true,
      ...proxyBody(host, apiKey, {
        braveApiKey,
        systemPrompt,
        priorImageUrls,
        searchMode,
        routerModel,
        debugMode,
      }),
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ||
        `Agent error ${res.status}: ${res.statusText}`
    );
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let metaReceived = false;

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

        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          if (metaReceived) {
            try {
              const chunk: OllamaChatResponseChunk = JSON.parse(trimmed);
              yield { type: "chunk", chunk };
              if (chunk.done) return;
            } catch {
              /* skip */
            }
          }
          continue;
        }

        if (parsed.redstone_status) {
          yield {
            type: "status",
            status: parsed.redstone_status as AgentStatusMeta,
          };
          continue;
        }

        if (parsed.redstone_meta) {
          yield {
            type: "meta",
            meta: parsed.redstone_meta as MessageSearchMeta,
          };
          metaReceived = true;
          continue;
        }

        if (parsed.error) {
          throw new Error(String(parsed.error));
        }

        if (metaReceived) {
          const chunk = parsed as unknown as OllamaChatResponseChunk;
          if (chunk.message !== undefined) {
            yield { type: "chunk", chunk };
            if (chunk.done) return;
          }
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
