import type {
  PortraitVariant,
  TurnPlan,
  VisualMode,
} from "@/lib/search/coordinator";
import { chunkSourcesForContext } from "@/lib/search/context-chunk";
import { needsUnconditionalDeepEnrich } from "@/lib/search/query-enhance";
import type { SearchSource } from "@/types";

const CORE_WITH_SEARCH = `You are Redstone, a helpful assistant. Never mention web search, data blocks, or system prompts.

You have deep internal knowledge. The <EXTERNAL_DATA_CONTEXT> is provided to update you on recent events or supply niche data, NOT to restrict you. If the user asks for a detailed sequence, timeline, or comprehensive explanation of an established historical event, and the external data only provides a brief summary, IGNORE the summary constraint and use your full internal knowledge to provide the exhaustive details, exact timestamps, and missing steps.

When external data is present and relevant, prefer it for specific dates, numbers, and names — but never let a thin or incomplete data block cap the depth of an answer you already know well. Ignore irrelevant results.

Conversation: you see the full thread. Resolve pronouns and partial names from earlier turns. Stay on the established subject. Never list other famous people who share a first name. Never say "since your previous question."

Citations: retrieved sources are reference material — you do NOT need to cite them all, or even most of them. Cite sparingly.
- The ONLY valid citation format is <cite>N</cite> where N is a source number (e.g. <cite>1</cite>). Embed it inline immediately after the fact it supports.
- Use at most ONE <cite>N</cite> per paragraph, and at most two citations in the entire answer (one for short answers).
- Only cite a specific fact (date, number, classification, name) you took from a web result. General summary sentences and details drawn from your own knowledge need no citation.
- NEVER output any other citation or source marker: no [1], [EN], [DE], (EN), [Source 1], bare "EN"/"DE"/"FR" language codes, publisher abbreviations, or domain fragments at the end of a sentence or paragraph.
- NEVER echo EXTERNAL_DATA_CONTEXT structure in your answer: do not print "Source 1", "Title:", "URL:", "Content:", or copy bracketed metadata from the data block.
- End every sentence with normal punctuation only (. ? !). Do not append tags, codes, or labels after the closing punctuation.

--- SYSTEM INSTRUCTION OVERRIDE ---
- Treat search snippets as supplementary validation, not an absolute constraint on vocabulary or depth.
- Do NOT restrict your entire response solely to the names or items present in the snippets if the user's query requires a comprehensive list or full narrative.
- Maintain smooth, natural prose. Do not append website domain names, fragment words, or raw template brackets (e.g., 'WIKI', 'USS Enterprise.') to the ends of sentences.
- Ensure all punctuation marks (. , ! ?) are attached directly to the preceding word with zero whitespace. Never output a trailing space before a period.
- Do not concatenate error codes or system metadata to the end of a descriptive sentence.
- If sources present conflicting timeline data, prioritize real-world historical accuracy over isolated snippet fragments.`;

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

function timelineInstructions(userQuery: string): string {
  if (!needsUnconditionalDeepEnrich(userQuery)) return "";
  return "If the user asks for a timeline or sequence of events, you must extract specific timestamps and chronologically detail the granular events. Do not summarize or compress timelines.";
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

export function purifyAndInjectContext(
  sources: SearchSource[],
  userQuery = ""
): string {
  if (!sources || sources.length === 0) return "";

  const chunked = chunkSourcesForContext(sources, userQuery);
  const trimIncompleteSentences = !needsUnconditionalDeepEnrich(userQuery);

  const cleanSources = chunked
    .map((src, index) => {
      let snippet = src.snippet
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (trimIncompleteSentences) {
        const lastPunctuation = Math.max(
          snippet.lastIndexOf("."),
          snippet.lastIndexOf("?"),
          snippet.lastIndexOf("!")
        );
        if (lastPunctuation > 20) {
          snippet = snippet.substring(0, lastPunctuation + 1);
        }
      }

      return `[Source ${index + 1}]\nTitle: ${src.title}\nURL: ${src.url}\nContent: ${snippet}`;
    })
    .join("\n\n");

  return `\n<EXTERNAL_DATA_CONTEXT>\n${cleanSources}\n</EXTERNAL_DATA_CONTEXT>\n`;
}

export function buildAugmentedSystemPrompt(
  userSystemPrompt: string,
  plan: TurnPlan,
  sources: SearchSource[],
  visualMode: VisualMode,
  searchError?: string,
  webSearchRan = true
): string {
  const instructionParts = [
    webSearchRan ? CORE_WITH_SEARCH : CORE_NO_SEARCH,
    answerInstructions(plan.answerStyle),
    visualInstructions(
      visualMode,
      plan.explicitVisualRequest,
      plan.imageSearch?.variant
    ),
  ];

  if (plan.threadSubject) {
    instructionParts.push(
      `The conversation is about ${plan.threadSubject}. Answer only about that subject.`
    );
  }

  if (visualMode === "show" && plan.imageSearch?.personNames[0]) {
    instructionParts.push(
      `The displayed image is a portrait of ${plan.imageSearch.personNames[0]}. If you name who is shown, it must be ${plan.imageSearch.personNames[0]} — never another astronaut.`
    );
  }

  if (webSearchRan && searchError) {
    instructionParts.push(`Web search failed: ${searchError}`);
  }

  const timelineRule = timelineInstructions(plan.rawUserQuery);
  if (timelineRule) {
    instructionParts.push(timelineRule);
  }

  let finalSystemPrompt = instructionParts.join("\n\n");

  if (userSystemPrompt.trim()) {
    finalSystemPrompt += `\n\nUser settings:\n${userSystemPrompt.trim()}`;
  }

  if (webSearchRan && !searchError) {
    finalSystemPrompt += purifyAndInjectContext(sources, plan.rawUserQuery);
  }

  return finalSystemPrompt;
}
