import { upstreamHeaders } from "@/lib/proxy";
import type { ImageSearchPlan } from "@/lib/search/coordinator";

export type OrchestratorPhase =
  | "orchestrate"
  | "web"
  | "image"
  | "generate";

export interface OrchestratorPlan {
  webSearch: boolean;
  webQuery: string;
  imageSearch: boolean;
  imageQuery: string;
  reason: string;
}

const ORCHESTRATOR_PROMPT = `You are the orchestrator for Redstone chat. Decide which tools to run BEFORE the main model answers.

Available tools:
- web_search: Brave web search for current facts, people, ships, missions, places, news, or specific entities.
- image_search: Find a photograph of a physical thing, vessel, facility, or person portrait.
- none: Answer from model knowledge only (greetings, coding, math, creative writing, opinions).

Reply with ONLY valid JSON, no markdown:
{"web_search":boolean,"web_query":"search query or empty","image_search":boolean,"image_query":"image subject or empty","reason":"one short phrase"}

Rules:
- web_query: concise Brave query when web_search is true.
- image_query: specific subject for photo search when image_search is true (e.g. "SL-1 nuclear reactor Idaho", "Neil Armstrong official portrait").
- Use image_search for "tell me about [thing/person]" when a photo would help.
- Use neither for hello, thanks, code, rewrite, or general chat.
- Prefer web_search for factual/historical questions about named entities.`;

/** Strip <think>…</think> blocks that Qwen3 and similar models prepend. */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
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
      web_search?: boolean;
      web_query?: string;
      image_search?: boolean;
      image_query?: string;
      reason?: string;
    };

    return {
      webSearch: !!data.web_search,
      webQuery: (data.web_query ?? "").trim(),
      imageSearch: !!data.image_search,
      imageQuery: (data.image_query ?? "").trim(),
      reason: (data.reason ?? "watchdog").trim(),
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
        // Disable thinking mode (Qwen3, Gemma4 etc.) so the token budget
        // isn't exhausted on <think> blocks before the JSON is written.
        think: false,
        messages: [
          {
            role: "user",
            content: `${ORCHESTRATOR_PROMPT}\n\nUser message: "${userQuery.trim()}"${context}`,
          },
        ],
        options: {
          temperature: 0,
          // Generous budget: thinking-disabled models still need room for JSON
          num_predict: 300,
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
