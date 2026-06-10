import { upstreamHeaders } from "@/lib/proxy";
import type { ImageSearchPlan } from "@/lib/search/coordinator";

export type RouterIntent =
  | "factual_query"
  | "procedural_task"
  | "creative"
  | "code_generation";

export type RouterUiHint =
  | "standard"
  | "table"
  | "step_by_step"
  | "comparison";

export interface OrchestratorPlan {
  intent: RouterIntent;
  webSearch: boolean;
  optimizedSearchQuery: string;
  imageSearch: boolean;
  imageQuery: string;
  uiHint: RouterUiHint;
}

const ORCHESTRATOR_PROMPT = `You are a rigid routing engine. Convert natural language user queries into raw, keyword-dense search strings optimized for search engines (e.g., convert 'What were the names of the senior officers of the USS Enterprise NCC-1701-D?' into 'USS Enterprise D senior staff main characters roster'). Determine the correct intent and layout hint.

First reason step-by-step in a thinking block (use model thinking tags). After your reasoning, output ONLY a single JSON object (no markdown fences) matching this shape:
{"intent":"...","web_search":true,"optimized_search_query":"...","image_search":false,"image_query":"...","ui_hint":"..."}

Field rules:
- intent: factual_query (facts/entities/history), procedural_task (how-to steps), creative (writing/brainstorm), code_generation (code/debug).
- web_search and image_search are independent — both may be true.
- optimized_search_query: keyword-dense Brave query with natural-language fluff stripped when web_search is true. For NASA missions, disasters, or historical events, include anchors like "NASA official timeline mission summary failure abort".
- image_query: disambiguated photo subject when image_search is true (e.g. "USS Enterprise NCC-1701-D Star Trek starship").
- ui_hint: standard (default prose), table (lists/rosters), step_by_step (procedures), comparison (A vs B).`;

/** Strip thinking blocks (Qwen3/Gemma) before JSON extraction. */
function stripThinking(text: string): string {
  const thinkEnd = new RegExp("</" + "think>", "i");
  const thinkMatch = text.match(thinkEnd);
  let after = text;
  if (thinkMatch?.index !== undefined) {
    after = text.slice(thinkMatch.index + thinkMatch[0].length);
  }
  return after
    .replace(
      /<think>[\s\S]*?<\/redacted_thinking>/gi,
      ""
    )
    .trim();
}

function extractJsonObject(text: string): string | null {
  // Strip thinking blocks first, then find outermost { }
  const cleaned = stripThinking(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function parseOrchestratorResponse(raw: string): OrchestratorPlan | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  try {
    const data = JSON.parse(jsonText) as {
      intent?: string;
      web_search?: boolean;
      optimized_search_query?: string;
      image_search?: boolean;
      image_query?: string;
      ui_hint?: string;
    };

    const intent = data.intent as RouterIntent | undefined;
    const uiHint = data.ui_hint as RouterUiHint | undefined;
    if (!intent || !uiHint) return null;

    return {
      intent,
      webSearch: !!data.web_search,
      optimizedSearchQuery: (data.optimized_search_query ?? "").trim(),
      imageSearch: !!data.image_search,
      imageQuery: (data.image_query ?? "").trim(),
      uiHint,
    };
  } catch {
    return null;
  }
}

export interface OrchestratorResult {
  plan: OrchestratorPlan | null;
  /** Human-readable failure reason when plan is null. */
  error?: string;
  /** Raw model output for debugging. */
  raw?: string;
}

/** Full watchdog call for aggressive mode. */
export async function runOrchestrator(
  host: string,
  apiKey: string,
  model: string,
  userQuery: string,
  threadSnippet: string
): Promise<OrchestratorResult> {
  if (!model.trim()) {
    return { plan: null, error: "no watchdog model configured" };
  }

  const context =
    threadSnippet.length > 0
      ? `\n\nRecent assistant reply (excerpt):\n${threadSnippet.slice(0, 500)}`
      : "";

  let res: Response;
  try {
    res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: upstreamHeaders(apiKey),
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: "user",
            content: `${ORCHESTRATOR_PROMPT}\n\nUser message: "${userQuery.trim()}"${context}`,
          },
        ],
        options: {
          temperature: 0,
          num_predict: 512,
          num_ctx: 4096,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    return { plan: null, error: `network error: ${String(e)}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const msg = (() => {
      try {
        return (JSON.parse(body) as { error?: string }).error ?? body;
      } catch {
        return body || `HTTP ${res.status}`;
      }
    })();
    return { plan: null, error: `Ollama ${res.status}: ${msg.slice(0, 200)}` };
  }

  const data = (await res.json()) as {
    message?: { content?: string };
    error?: string;
  };

  if (data.error) {
    return { plan: null, error: data.error };
  }

  const raw = data.message?.content ?? "";
  const plan = parseOrchestratorResponse(raw);

  if (!plan) {
    return {
      plan: null,
      error: `could not parse JSON from model output`,
      raw: raw.slice(0, 500),
    };
  }

  return { plan, raw };
}

/** Build image search plan from orchestrator subject string. */
export function imagePlanFromOrchestrator(
  subject: string,
  excludeUrls: string[] = []
): ImageSearchPlan | null {
  const label = subject.trim();
  if (!label) return null;

  const terms = label
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  return {
    queries: [`"${label}" photograph`, `${label} historical photo`],
    matchTerms: [...terms, label.toLowerCase()],
    personNames: [],
    avoidPeople: [],
    preferPortrait: /\b(portrait|astronaut|commander|pilot)\b/i.test(label),
    variant: "default",
    excludeUrls,
  };
}
