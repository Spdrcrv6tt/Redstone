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
  enrichSourcesWithDeepContent,
  resolveBraveApiKey,
} from "@/lib/search/brave";
import { enhanceSearchQuery } from "@/lib/search/query-enhance";
import { finalizeVisualMode, planTurn } from "@/lib/search/coordinator";
import {
  pickEmbedLinks,
  searchYouTubeVideos,
  videosFromSources,
} from "@/lib/search/embed-media";
import {
  buildAugmentedSystemPrompt,
  buildDiagramSystemPrompt,
  buildFlashcardSystemPrompt,
  buildImageGenerationSystemPrompt,
  buildQuizSystemPrompt,
} from "@/lib/search/prompt";
import {
  encodeMetaLine,
  encodeStatusLine,
} from "@/lib/search/stream-protocol";
import type { OllamaChatMessage } from "@/types";
import type {
  AgentPipelineStatus,
  AgentStreamMeta,
  SearchMode,
  SearchSource,
} from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function parseSearchMode(value: unknown): SearchMode {
  if (value === "always" || value === "never" || value === "auto") {
    return value;
  }
  // Legacy clients may still send "aggressive" — treat as auto.
  return "auto";
}

type StatusEmitter = (state: AgentPipelineStatus, message: string) => void;

const BLACKLISTED_SOURCE_DOMAINS = [
  "fed-space.com",
  "memory-beta.wikia.com",
  "memory-beta.fandom.com",
];

function filterBlacklistedSources(sources: SearchSource[]): SearchSource[] {
  return sources.filter((source) => {
    try {
      const host = new URL(source.url).hostname.toLowerCase();
      return !BLACKLISTED_SOURCE_DOMAINS.some(
        (domain) => host === domain || host.endsWith(`.${domain}`)
      );
    } catch {
      return true;
    }
  });
}

interface PipelineInput {
  braveKey: string;
  conversationMessages: OllamaChatMessage[];
  rawUserQuery: string;
  priorImageUrls: string[];
  searchMode: SearchMode;
  debugMode: boolean;
  userSystemPrompt: string;
  emitStatus: StatusEmitter;
}

interface PipelineResult {
  meta: AgentStreamMeta;
  upstreamMessages: OllamaChatMessage[];
  systemContent: string;
}

async function runAgentPipeline(input: PipelineInput): Promise<PipelineResult> {
  const {
    braveKey,
    conversationMessages,
    rawUserQuery,
    priorImageUrls,
    searchMode,
    debugMode,
    userSystemPrompt,
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

  emitStatus("routing", "Planning turn…");

  if (searchMode === "always") {
    runWebSearch = true;
    searchReason = "search mode: always";
    searchConfidence = "high";
  } else if (searchMode === "never") {
    runWebSearch = false;
    searchReason = "search mode: never";
    searchConfidence = "high";
  }

  const finalSearchQuery = enhanceSearchQuery(draftPlan.webSearchQuery);
  const imagePlanEarly = draftPlan.imageSearch;

  const needsWeb = runWebSearch && !!finalSearchQuery && !!braveKey;
  const needsImage =
    !!imagePlanEarly &&
    !!braveKey &&
    !draftPlan.needsDiagram &&
    !draftPlan.needsImageGeneration &&
    !draftPlan.studyMode;

  if (runWebSearch && !braveKey) {
    searchError = "Brave Search API key is not configured";
  } else if (needsWeb || needsImage) {
    emitStatus("searching", "Querying live web endpoints...");
    const t0 = Date.now();

    const webTask = async (): Promise<{
      sources: SearchSource[];
      searchError?: string;
    }> => {
      if (!needsWeb) return { sources: [] };
      try {
        if (draftPlan.exhaustiveList) {
          const queries = [
            enhanceSearchQuery(draftPlan.webSearchQuery),
            ...draftPlan.supplementalWebQueries.map(enhanceSearchQuery),
          ];
          let batch = await executeWebSearches(queries, braveKey, 10);
          batch = await enrichSourcesForList(batch);
          batch = filterBlacklistedSources(batch);
          batch = await enrichSourcesWithDeepContent(batch, rawUserQuery);
          return { sources: batch };
        }
        const webOnly = await executeSearch(finalSearchQuery, null, braveKey);
        let batch = webOnly.sources;
        if (webOnly.searchError) {
          return { sources: batch, searchError: webOnly.searchError };
        }
        batch = filterBlacklistedSources(batch);
        batch = await enrichSourcesWithDeepContent(batch, rawUserQuery);
        return { sources: batch };
      } catch (err) {
        return {
          sources: [],
          searchError:
            err instanceof Error ? err.message : "Web search failed",
        };
      }
    };

    const imageTask = async (): Promise<{
      images: AgentStreamMeta["images"];
      imageError?: string;
      fallbackSources: SearchSource[];
    }> => {
      if (!needsImage || !imagePlanEarly) {
        return { images: [], fallbackSources: [] };
      }
      try {
        const withImages = await executeSearch(
          "",
          imagePlanEarly,
          braveKey,
          { skipWeb: true }
        );
        return {
          images: withImages.images,
          imageError: withImages.imageError,
          fallbackSources: withImages.sources,
        };
      } catch (err) {
        return {
          images: [],
          imageError:
            err instanceof Error ? err.message : "Image search failed",
          fallbackSources: [],
        };
      }
    };

    const [webResult, imageResult] = await Promise.all([
      webTask(),
      imageTask(),
    ]);

    sources = webResult.sources;
    searchError = webResult.searchError;
    images = imageResult.images;
    imageError = imageResult.imageError;
    if (!sources.length && runWebSearch && imageResult.fallbackSources.length) {
      sources = imageResult.fallbackSources;
    }

    searchMs = Date.now() - t0;
    imageMs = Date.now() - t0;
  }

  const turnPlan = planTurn(
    conversationMessages,
    rawUserQuery,
    sources,
    priorImageUrls
  );

  let videos: AgentStreamMeta["videos"] = [];
  let links: AgentStreamMeta["links"] = [];

  if (sources.length && turnPlan.embedVideo) {
    videos = videosFromSources(sources);
    if (!videos.length && braveKey) {
      try {
        videos = await searchYouTubeVideos(
          finalSearchQuery || rawUserQuery,
          braveKey
        );
      } catch {
        /* optional YouTube search */
      }
    }
  }

  if (sources.length && turnPlan.embedLinks) {
    links = pickEmbedLinks(sources, {
      excludeUrls: videos?.map((v) => v.url) ?? [],
    });
  }

  const visualMode = finalizeVisualMode(turnPlan, images.length);

  emitStatus(
    "injecting",
    turnPlan.studyMode === "flashcards"
      ? "Preparing flashcard deck..."
      : turnPlan.studyMode === "quiz"
        ? "Preparing practice quiz..."
        : turnPlan.needsDiagram
          ? "Preparing widget architect prompt..."
          : turnPlan.needsImageGeneration
            ? "Preparing image prompt engineer..."
            : "Purifying and binding verified context..."
  );

  const systemContent =
    turnPlan.studyMode === "flashcards"
      ? buildFlashcardSystemPrompt(
          userSystemPrompt,
          turnPlan,
          sources,
          searchError,
          runWebSearch,
          conversationMessages
        )
      : turnPlan.studyMode === "quiz"
        ? buildQuizSystemPrompt(
            userSystemPrompt,
            turnPlan,
            sources,
            searchError,
            runWebSearch,
            conversationMessages
          )
        : turnPlan.needsDiagram
          ? buildDiagramSystemPrompt(
              userSystemPrompt,
              turnPlan,
              sources,
              searchError,
              runWebSearch,
              conversationMessages
            )
          : turnPlan.needsImageGeneration
            ? buildImageGenerationSystemPrompt(
                userSystemPrompt,
                turnPlan,
                sources,
                searchError,
                runWebSearch,
                conversationMessages
              )
            : buildAugmentedSystemPrompt(
                userSystemPrompt,
                turnPlan,
                sources,
                visualMode,
                searchError,
                runWebSearch,
                conversationMessages,
                {
                  videoCount: videos?.length ?? 0,
                  linkCount: links?.length ?? 0,
                }
              );

  const upstreamMessages: OllamaChatMessage[] = [
    { role: "system", content: systemContent },
    ...conversationMessages,
  ];

  const meta: AgentStreamMeta = {
    sources,
    images,
    videos,
    links,
    query: runWebSearch ? finalSearchQuery : "",
    searchDecision: {
      ran: runWebSearch,
      reason: searchReason,
      confidence: searchConfidence,
      mode: searchMode,
    },
    ...(searchError ? { searchError } : {}),
    ...(imageError ? { imageError } : {}),
    ...(debugMode
      ? {
          debug: {
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
    _routerModel: ___,
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
  const debugMode = _debugMode === true;
  const userSystemPrompt =
    typeof _systemPrompt === "string" ? _systemPrompt : "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emitStatus: StatusEmitter = (state, message) => {
        controller.enqueue(
          encoder.encode(encodeStatusLine({ redstone_status: state, message }))
        );
      };

      try {
        const pipeline = await runAgentPipeline({
          braveKey,
          conversationMessages,
          rawUserQuery,
          priorImageUrls,
          searchMode,
          debugMode,
          userSystemPrompt,
          emitStatus,
        });

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
