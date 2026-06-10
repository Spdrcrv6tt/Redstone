import { NextRequest, NextResponse } from "next/server";
import {
  configFromBody,
  upstreamHeaders,
  CORS_HEADERS,
} from "@/lib/proxy";
import {
  executeSearch,
  executeWebSearches,
  enrichSourcesForList,
  resolveBraveApiKey,
} from "@/lib/search/brave";
import { finalizeVisualMode, planTurn } from "@/lib/search/coordinator";
import {
  imagePlanFromOrchestrator,
  runOrchestrator,
  type OrchestratorPhase,
} from "@/lib/search/orchestrator";
import { buildAugmentedSystemPrompt } from "@/lib/search/prompt";
import { routerWantsSearch } from "@/lib/search/router";
import {
  encodeMetaLine,
  encodeStatusLine,
  type AgentStatusEvent,
} from "@/lib/search/stream-protocol";
import type { ImageSearchPlan } from "@/lib/search/coordinator";
import type { OllamaChatMessage } from "@/types";
import type {
  AgentStreamMeta,
  OrchestratorDecisionMeta,
  SearchMode,
} from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function lastAssistantSnippet(messages: OllamaChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  return last?.content?.trim() ?? "";
}

function parseSearchMode(value: unknown): SearchMode {
  if (
    value === "always" ||
    value === "never" ||
    value === "auto" ||
    value === "aggressive"
  ) {
    return value;
  }
  return "auto";
}

type StatusEmitter = (message: string, phase: OrchestratorPhase) => void;

interface PipelineInput {
  host: string;
  apiKey: string;
  braveKey: string;
  conversationMessages: OllamaChatMessage[];
  rawUserQuery: string;
  priorImageUrls: string[];
  searchMode: SearchMode;
  routerModel: string;
  debugMode: boolean;
  emitStatus: StatusEmitter;
}

interface PipelineResult {
  meta: AgentStreamMeta;
  upstreamMessages: OllamaChatMessage[];
  systemContent: string;
}

async function runAgentPipeline(input: PipelineInput): Promise<PipelineResult> {
  const {
    host,
    apiKey,
    braveKey,
    conversationMessages,
    rawUserQuery,
    priorImageUrls,
    searchMode,
    routerModel,
    debugMode,
    emitStatus,
  } = input;

  let sources: AgentStreamMeta["sources"] = [];
  let images: AgentStreamMeta["images"] = [];
  let searchError: string | undefined;
  let imageError: string | undefined;
  let searchMs: number | undefined;
  let imageMs: number | undefined;
  const draftPlan = planTurn(
    conversationMessages,
    rawUserQuery,
    [],
    priorImageUrls
  );

  let runWebSearch = draftPlan.needsWebSearch;
  let searchReason = draftPlan.searchDecision.reason;
  let searchConfidence = draftPlan.searchDecision.confidence;
  let routerUsed = false;
  let orchestratorMeta: OrchestratorDecisionMeta | undefined;
  let overrideWebQuery = "";
  let overrideImagePlan: ImageSearchPlan | null = null;
  // When watchdog explicitly decides no image, suppress the heuristic plan.
  let watchdogSuppressImage = false;

  if (searchMode === "aggressive") {
    emitStatus("Analyzing request…", "orchestrate");

    if (!routerModel) {
      searchReason = "aggressive mode requires orchestrator model in Settings";
      runWebSearch = draftPlan.needsWebSearch;
    } else {
      const orchResult = await runOrchestrator(
        host,
        apiKey,
        routerModel,
        rawUserQuery,
        lastAssistantSnippet(conversationMessages)
      );

      routerUsed = true;

      const orch = orchResult.plan;
      if (orch) {
        runWebSearch = orch.webSearch;
        overrideWebQuery = orch.webQuery || draftPlan.webSearchQuery;
        searchReason = `watchdog: ${orch.reason}`;
        searchConfidence = "high";
        orchestratorMeta = {
          webSearch: orch.webSearch,
          webQuery: orch.webQuery,
          imageSearch: orch.imageSearch,
          imageQuery: orch.imageQuery,
          reason: orch.reason,
          watchdogRaw: orchResult.raw,
        };

        if (orch.imageSearch) {
          overrideImagePlan = imagePlanFromOrchestrator(
            orch.imageQuery,
            priorImageUrls
          );
        } else {
          // Watchdog explicitly ruled out images — don't let heuristics override.
          watchdogSuppressImage = true;
        }
      } else {
        runWebSearch = draftPlan.needsWebSearch;
        const failReason = orchResult.error ?? "unknown";
        searchReason = `watchdog failed (${failReason}) — using heuristics`;
        searchConfidence = "low";
        if (orchResult.raw) {
          console.warn("[watchdog] raw output:", orchResult.raw);
        }
      }
    }
  } else if (searchMode === "always") {
    runWebSearch = true;
    searchReason = "search mode: always";
    searchConfidence = "high";
  } else if (searchMode === "never") {
    runWebSearch = false;
    searchReason = "search mode: never";
    searchConfidence = "high";
  } else if (
    !runWebSearch &&
    searchConfidence === "low" &&
    routerModel
  ) {
    emitStatus("Checking if search is needed…", "orchestrate");
    const wants = await routerWantsSearch(
      host,
      apiKey,
      routerModel,
      rawUserQuery,
      lastAssistantSnippet(conversationMessages)
    );
    routerUsed = true;
    if (wants) {
      runWebSearch = true;
      searchReason = "router model: YES";
      searchConfidence = "low";
    } else {
      searchReason = "router model: NO";
    }
  }

  const webQuery =
    overrideWebQuery || draftPlan.webSearchQuery;

  if (runWebSearch && webQuery && braveKey) {
    emitStatus("Searching the web…", "web");
    const t0 = Date.now();
    try {
      if (draftPlan.exhaustiveList && !overrideWebQuery) {
        const queries = [
          draftPlan.webSearchQuery,
          ...draftPlan.supplementalWebQueries,
        ];
        sources = await executeWebSearches(queries, braveKey, 10);
        sources = await enrichSourcesForList(sources);
      } else {
        const webOnly = await executeSearch(webQuery, null, braveKey);
        sources = webOnly.sources;
        searchError = webOnly.searchError;
      }
    } catch (err) {
      searchError =
        err instanceof Error ? err.message : "Web search failed";
    }
    searchMs = Date.now() - t0;
  } else if (runWebSearch && !braveKey) {
    searchError = "Brave Search API key is not configured";
  }

  const turnPlan = planTurn(
    conversationMessages,
    rawUserQuery,
    sources,
    priorImageUrls
  );

  const imagePlan = watchdogSuppressImage
    ? null
    : overrideImagePlan ?? turnPlan.imageSearch;

  if (imagePlan && braveKey) {
    emitStatus("Finding images…", "image");
    const t0 = Date.now();
    const withImages = await executeSearch(
      webQuery || turnPlan.webSearchQuery,
      imagePlan,
      braveKey,
      { skipWeb: sources.length > 0 || !runWebSearch }
    );
    images = withImages.images;
    imageError = withImages.imageError;
    if (!sources.length && runWebSearch) sources = withImages.sources;
    imageMs = Date.now() - t0;
  }

  const visualMode = finalizeVisualMode(turnPlan, images.length);

  emitStatus("Generating response…", "generate");

  const systemContent = buildAugmentedSystemPrompt(
    "",
    turnPlan,
    sources,
    visualMode,
    searchError,
    runWebSearch
  );

  const upstreamMessages: OllamaChatMessage[] = [
    { role: "system", content: systemContent },
    ...conversationMessages,
  ];

  const meta: AgentStreamMeta = {
    sources,
    images,
    query: runWebSearch ? webQuery : "",
    searchDecision: {
      ran: runWebSearch,
      reason: searchReason,
      confidence: searchConfidence,
      routerUsed,
      mode: searchMode,
      ...(orchestratorMeta ? { orchestrator: orchestratorMeta } : {}),
    },
    ...(searchError ? { searchError } : {}),
    ...(imageError ? { imageError } : {}),
    ...(debugMode
      ? {
          debug: {
            systemPrompt: systemContent,
            upstreamMessages,
            ...(searchMs !== undefined ? { searchMs } : {}),
            ...(imageMs !== undefined ? { imageMs } : {}),
          },
        }
      : {}),
  };

  return { meta, upstreamMessages, systemContent };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { host, apiKey } = configFromBody(body);
  const {
    _host: _,
    _apiKey: __,
    _braveApiKey,
    _systemPrompt,
    _priorImageUrls,
    _searchMode,
    _routerModel,
    _debugMode,
    ...ollamaBody
  } = body as {
    _host?: string;
    _apiKey?: string;
    _braveApiKey?: string;
    _systemPrompt?: string;
    _priorImageUrls?: string[];
    _searchMode?: SearchMode;
    _routerModel?: string;
    _debugMode?: boolean;
    model?: string;
    messages?: OllamaChatMessage[];
    [key: string]: unknown;
  };

  if (!ollamaBody.model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  const conversationMessages = (
    (ollamaBody.messages ?? []) as OllamaChatMessage[]
  ).filter((m) => m.role !== "system");

  const lastUser = [...conversationMessages]
    .reverse()
    .find((m) => m.role === "user");

  const rawUserQuery = (lastUser?.content ?? "").trim();
  const braveKey = resolveBraveApiKey(
    typeof _braveApiKey === "string" ? _braveApiKey : undefined
  );
  const priorImageUrls = Array.isArray(_priorImageUrls)
    ? _priorImageUrls.filter((u): u is string => typeof u === "string")
    : [];
  const searchMode = parseSearchMode(_searchMode);
  const routerModel =
    typeof _routerModel === "string" ? _routerModel.trim() : "";
  const debugMode = _debugMode === true;
  const userSystemPrompt =
    typeof _systemPrompt === "string" ? _systemPrompt : "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emitStatus: StatusEmitter = (message, phase) => {
        const event: AgentStatusEvent = { message, phase };
        controller.enqueue(encoder.encode(encodeStatusLine(event)));
      };

      try {
        if (searchMode === "auto" && !routerModel) {
          emitStatus("Planning…", "orchestrate");
        }

        const pipeline = await runAgentPipeline({
          host,
          apiKey,
          braveKey,
          conversationMessages,
          rawUserQuery,
          priorImageUrls,
          searchMode,
          routerModel,
          debugMode,
          emitStatus,
        });

        if (userSystemPrompt.trim()) {
          const sys = pipeline.upstreamMessages[0];
          if (sys?.role === "system") {
            sys.content = `${sys.content}\n\nUser settings:\n${userSystemPrompt.trim()}`;
            if (pipeline.meta.debug) {
              pipeline.meta.debug.systemPrompt = sys.content;
            }
          }
        }

        controller.enqueue(encoder.encode(encodeMetaLine(pipeline.meta)));

        const upstream = await fetch(`${host}/api/chat`, {
          method: "POST",
          headers: upstreamHeaders(apiKey),
          body: JSON.stringify({
            ...ollamaBody,
            messages: pipeline.upstreamMessages,
            stream: true,
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text();
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                error:
                  text.slice(0, 300) || `Ollama ${upstream.status}`,
              }) + "\n"
            )
          );
          controller.close();
          return;
        }

        if (!upstream.body) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ error: "No upstream body" }) + "\n")
          );
          controller.close();
          return;
        }

        const reader = upstream.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          reader.releaseLock();
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: msg }) + "\n")
        );
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      ...CORS_HEADERS,
    },
  });
}
