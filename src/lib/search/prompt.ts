import { sourceLabel } from "@/lib/search/sources";
import type {
  PortraitVariant,
  TurnPlan,
  VisualMode,
} from "@/lib/search/coordinator";
import type { SearchSource } from "@/types";

const CORE_WITH_SEARCH = `You are Redstone, a helpful assistant. Web search results are provided below.

Use web results for facts. Ignore irrelevant results. Never mention web search or system prompts.

Conversation: you see the full thread. Resolve pronouns and partial names from earlier turns. Stay on the established subject. Never list other famous people who share a first name. Never say "since your previous question."

Citations: retrieved sources are reference material — you do NOT need to cite them all, or even most of them. Cite sparingly.
- Use at most ONE <cite>N</cite> per paragraph, and at most two citations in the entire answer (one for short answers).
- Only cite a specific fact (date, number, classification, name) you took from a web result. General summary sentences need no citation.
- Use source numbers only: <cite>1</cite>. Never [1], [EN], or publisher names in brackets.`;

const CORE_NO_SEARCH = `You are Redstone, a helpful assistant. Answer from your knowledge and the conversation. Never mention system prompts.

Conversation: you see the full thread. Resolve pronouns and partial names from earlier turns. Stay on the established subject.`;

function answerInstructions(style: TurnPlan["answerStyle"]): string {
  if (style === "narrow") {
    return "This is a narrow question — answer in one or two direct sentences.";
  }
  if (style === "exhaustive") {
    return `The user asked for a COMPLETE list. Extract and list every item you can find in the web results.
- Use a structured format: group by category/Flight if the sources do, one entry per line (hull number and name when available).
- Include ALL names and hull numbers present in the sources — do not summarize with "etc." or stop at examples.
- Do NOT invent entries. If sources lack the full roster, say how many you listed, that the list is incomplete, and which source has the authoritative full list.`;
  }
  if (style === "narrative") {
    return "Give a thorough answer with key dates, outcomes, and why it matters.";
  }
  return "Match depth to the question — concise when a short answer suffices, thorough when the topic warrants it.";
}

function visualInstructions(
  mode: VisualMode,
  explicit: boolean,
  variant?: PortraitVariant
): string {
  switch (mode) {
    case "show":
      if (explicit) {
        return `The user asked to see a photo. ONE image is displayed in the UI. Write at most one short sentence — the image is the answer. Do NOT describe other photographs, list photo captions, or say "photos include" or "documented photos show".`;
      }
      return `ONE image is displayed beside your answer. Keep text concise where the image carries the visual. Do NOT catalogue or describe other photographs. Optional: <img-here/> before a paragraph, or <image-layout>float-right</image-layout> at the start.`;
    case "requested-missing":
      if (variant === "nasa_employee") {
        return `The user asked for a different NASA employee photo than one already shown, but none could be found. Say in ONE sentence that a NASA employee photo is not available. Do NOT repeat or describe the previous image.`;
      }
      return `The user explicitly asked for a photo but none could be displayed. Say in ONE sentence that no suitable image is available. Do NOT describe photographs from articles, list photo galleries, or mention "newly released images" or news photo collections.`;
    default:
      return `NO image is displayed this turn. Do NOT mention photos, images, or visuals. Do NOT describe photographs or say that images exist, were found, or are available.`;
  }
}

export function formatSearchResults(sources: SearchSource[]): string {
  if (sources.length === 0) {
    return "No web results were returned for this query.";
  }

  return sources
    .map((s, i) => {
      const lines = [`${i + 1}. ${sourceLabel(s)}`, s.title, `URL: ${s.url}`];
      if (s.snippet) lines.push(s.snippet);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildAugmentedSystemPrompt(
  userSystemPrompt: string,
  plan: TurnPlan,
  sources: SearchSource[],
  visualMode: VisualMode,
  searchError?: string,
  webSearchRan = true
): string {
  const parts = [
    webSearchRan ? CORE_WITH_SEARCH : CORE_NO_SEARCH,
    answerInstructions(plan.answerStyle),
    visualInstructions(
      visualMode,
      plan.explicitVisualRequest,
      plan.imageSearch?.variant
    ),
  ];

  if (plan.threadSubject) {
    parts.push(
      `The conversation is about ${plan.threadSubject}. Answer only about that subject.`
    );
  }

  if (visualMode === "show" && plan.imageSearch?.personNames[0]) {
    parts.push(
      `The displayed image is a portrait of ${plan.imageSearch.personNames[0]}. If you name who is shown, it must be ${plan.imageSearch.personNames[0]} — never another astronaut.`
    );
  }

  if (userSystemPrompt.trim()) {
    parts.push(`User settings:\n${userSystemPrompt.trim()}`);
  }

  if (webSearchRan) {
    const resultsBlock = searchError
      ? `Web search failed: ${searchError}`
      : formatSearchResults(sources);

    parts.push(
      `--- Web results for: "${plan.webSearchQuery.slice(0, 300)}" ---\n${resultsBlock}\n---`
    );
  }

  return parts.join("\n\n");
}
