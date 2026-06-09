import { upstreamHeaders } from "@/lib/proxy";

const ROUTER_PROMPT = `You route user messages for a chat app. Reply with exactly one word: YES or NO.

YES = the message needs live web search (current events, specific facts, people, ships, missions, places, or anything after 2023 the model might not know).
NO = general knowledge, creative writing, coding, math, greetings, opinions, or follow-ups already answered in the thread.

User message:`;

/** Fast micro-model call when heuristics are uncertain. */
export async function routerWantsSearch(
  host: string,
  apiKey: string,
  routerModel: string,
  userQuery: string,
  threadSnippet: string
): Promise<boolean> {
  const model = routerModel.trim();
  if (!model) return false;

  const context =
    threadSnippet.length > 0
      ? `\n\nRecent thread (last assistant reply excerpt):\n${threadSnippet.slice(0, 400)}`
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
            content: `${ROUTER_PROMPT}\n"${userQuery.trim()}"${context}`,
          },
        ],
        options: {
          temperature: 0,
          num_predict: 4,
          num_ctx: 2048,
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return false;

    const data = (await res.json()) as {
      message?: { content?: string };
    };
    const answer = (data.message?.content ?? "").trim().toUpperCase();
    return answer.startsWith("YES");
  } catch {
    return false;
  }
}
