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
import { buildAugmentedSystemPrompt } from "@/lib/search/prompt";
import type { OllamaChatMessage } from "@/types";
import type { AgentStreamMeta } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
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
    ...ollamaBody
  } = body as {
    _host?: string;
    _apiKey?: string;
    _braveApiKey?: string;
    _systemPrompt?: string;
    _priorImageUrls?: string[];
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
  const origin = req.nextUrl.origin;
  const priorImageUrls = Array.isArray(_priorImageUrls)
    ? _priorImageUrls.filter((u): u is string => typeof u === "string")
    : [];

  let sources: AgentStreamMeta["sources"] = [];
  let images: AgentStreamMeta["images"] = [];
  let searchError: string | undefined;
  let imageError: string | undefined;

  const draftPlan = planTurn(
    conversationMessages,
    rawUserQuery,
    [],
    priorImageUrls
  );

  if (draftPlan.webSearchQuery) {
    try {
      if (draftPlan.exhaustiveList) {
        const queries = [
          draftPlan.webSearchQuery,
          ...draftPlan.supplementalWebQueries,
        ];
        sources = await executeWebSearches(queries, braveKey, 10);
        sources = await enrichSourcesForList(sources);
      } else {
        const webOnly = await executeSearch(
          draftPlan.webSearchQuery,
          null,
          braveKey,
          origin
        );
        sources = webOnly.sources;
        searchError = webOnly.searchError;
      }
    } catch (err) {
      searchError =
        err instanceof Error ? err.message : "Web search failed";
    }
  }

  const turnPlan = planTurn(
    conversationMessages,
    rawUserQuery,
    sources,
    priorImageUrls
  );

  if (turnPlan.imageSearch) {
    const withImages = await executeSearch(
      turnPlan.webSearchQuery,
      turnPlan.imageSearch,
      braveKey,
      origin
    );
    images = withImages.images;
    imageError = withImages.imageError;
    if (!sources.length) sources = withImages.sources;
  }

  const visualMode = finalizeVisualMode(turnPlan, images.length);

  const systemContent = buildAugmentedSystemPrompt(
    typeof _systemPrompt === "string" ? _systemPrompt : "",
    turnPlan,
    sources,
    visualMode,
    searchError
  );

  const upstreamMessages: OllamaChatMessage[] = [
    { role: "system", content: systemContent },
    ...conversationMessages,
  ];

  try {
    const upstream = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: upstreamHeaders(apiKey),
      body: JSON.stringify({
        ...ollamaBody,
        messages: upstreamMessages,
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let errorBody: object;
      try {
        errorBody = JSON.parse(text);
      } catch {
        errorBody = {
          error: `Ollama ${upstream.status}: ${text.slice(0, 300) || upstream.statusText}`,
        };
      }
      return NextResponse.json(errorBody, { status: upstream.status });
    }

    if (!upstream.body) {
      return NextResponse.json({ error: "No upstream body" }, { status: 502 });
    }

    const meta: AgentStreamMeta = {
      sources,
      images,
      query: turnPlan.webSearchQuery,
      ...(searchError ? { searchError } : {}),
      ...(imageError ? { imageError } : {}),
    };

    const encoder = new TextEncoder();
    const metaLine = JSON.stringify({ redstone_meta: meta }) + "\n";

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(metaLine));
        const reader = upstream.body!.getReader();
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
