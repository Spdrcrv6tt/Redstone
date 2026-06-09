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

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
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
      reason: (data.reason ?? "orchestrator").trim(),
    };
  } catch {
    return null;
  }
}

/** Full orchestrator call for aggressive mode. */
export async function runOrchestrator(
  host: string,
  apiKey: string,
  model: string,
  userQuery: string,
  threadSnippet: string
): Promise<OrchestratorPlan | null> {
  const context =
    threadSnippet.length > 0
      ? `\n\nRecent assistant reply (excerpt):\n${threadSnippet.slice(0, 500)}`
      : "";

  try {
    const res = await fetch(`${host}/api/chat`, {
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
          num_predict: 180,
          num_ctx: 4096,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      message?: { content?: string };
    };
    return parseOrchestratorResponse(data.message?.content ?? "");
  } catch {
    return null;
  }
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
