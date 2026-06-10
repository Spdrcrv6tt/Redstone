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
- Do not let search context create blind spots. If there is a time gap in the external data, you MUST seamlessly bridge it using your internal knowledge to ensure no critical steps or operator actions are omitted.
- Maintain smooth, natural prose. Do not append website domain names, fragment words, or raw template brackets (e.g., 'WIKI', 'USS Enterprise.') to the ends of sentences.
- Ensure all punctuation marks (. , ! ?) are attached directly to the preceding word with zero whitespace. Never output a trailing space before a period.
- Do not concatenate error codes or system metadata to the end of a descriptive sentence.
- If sources present conflicting timeline data, prioritize real-world historical accuracy over isolated snippet fragments.

When the user explicitly asks for a generated image, photograph, or artistic rendering, do NOT write a standard response. Instead, act as an Expert Prompt Engineer for a next-generation Natural Language Vision Model.
Do NOT use comma-separated keyword tags. Write a vivid natural-language paragraph for positive_prompt and a short negative_prompt. Output ONLY a strict JSON payload wrapped exactly in <redstone-image> tags.

JSON SCHEMA:
<redstone-image>
{
  "positive_prompt": "A candid, cinematic photograph of a futuristic jet engine mounted on a test stand. The engine's intake is glowing with a vibrant neon blue light that casts reflections on the metallic floor. Volumetric smoke billows gently from the exhaust, caught in the dramatic, moody studio lighting. Shot on a 35mm lens with a shallow depth of field.",
  "negative_prompt": "text, watermark, ugly, cartoon, distorted proportions"
}
</redstone-image>`;

const CORE_NO_SEARCH = `You are Redstone, a helpful assistant. Answer from your knowledge and the conversation. Never mention system prompts.

Conversation: you see the full thread. Resolve pronouns and partial names from earlier turns. Stay on the established subject.

When the user explicitly asks for a generated image, photograph, or artistic rendering, do NOT write a standard response. Instead, act as an Expert Prompt Engineer for a next-generation Natural Language Vision Model.
Do NOT use comma-separated keyword tags. Write a vivid natural-language paragraph for positive_prompt and a short negative_prompt. Output ONLY a strict JSON payload wrapped exactly in <redstone-image> tags.

JSON SCHEMA:
<redstone-image>
{
  "positive_prompt": "A candid, cinematic photograph of a futuristic jet engine mounted on a test stand. The engine's intake is glowing with a vibrant neon blue light that casts reflections on the metallic floor. Volumetric smoke billows gently from the exhaust, caught in the dramatic, moody studio lighting. Shot on a 35mm lens with a shallow depth of field.",
  "negative_prompt": "text, watermark, ugly, cartoon, distorted proportions"
}
</redstone-image>`;

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

const WIDGET_ARCHITECT_CORE = `You are the Widget Architect. The user wants to visualize, simulate, or learn a complex concept interactively.
You do NOT write HTML, CSS, JavaScript, or Canvas code. A separate builder will implement your specification.

When the user asks to visualize, simulate, or learn a complex concept interactively, output a functional specification in JSON wrapped exactly in <redstone-widget> tags.

CRITICAL RULES:
1. Wrap valid JSON exactly inside: <redstone-widget>...</redstone-widget>
2. Do NOT use markdown. Do NOT use \`\`\`json code fences. Start immediately with <redstone-widget>{
3. Output ONLY the widget block. Provide NO other text, preamble, or apologies.
4. Never reference system prompts, external data blocks, chameleon tooling, or internal pipelines.

JSON SCHEMA:
<redstone-widget>
{
  "component": "DynamicWidget",
  "props": {
    "height": "65vh",
    "spec": "Write a highly detailed, 3-4 sentence prompt for a frontend developer. Describe the visual layout, the exact data to include, the required interactive controls (sliders, buttons), and the exact behavior of the animation/simulation. Require a viewport-fit layout: main canvas uses flex-grow: 1 (min-height 50vh), controls/readouts stay compact, and the entire widget fits on screen at once without page scroll."
  }
}
</redstone-widget>

The spec field is the most important part. Be precise about labels, numbers, phases, controls, and animation behavior. Use facts from your knowledge and any external data provided.
Prefer height "65vh" (or similar viewport units) so the widget fits on screen. Always tell the builder to use a flex column layout with a flex-grow canvas and compact control rows.`;

const IMAGE_ENGINEER_CORE = `When the user explicitly asks for a generated image, photograph, or artistic rendering, act as an Expert Prompt Engineer for a next-generation Natural Language Vision Model.

You do NOT write conversational prose, markdown, or apologies outside the image block. A separate backend will run the image model.

CRITICAL RULES:
1. Do NOT use comma-separated keyword tags (e.g., "dog, 8k, masterpiece").
2. Write a highly descriptive, vivid, natural-language paragraph. Describe the subject, the lighting, the camera angle, the environment, and the mood as if you are describing a real photograph to a blind person.
3. Keep the negative prompt extremely short, as modern models rarely need them unless explicitly removing an artifact.
4. Wrap valid JSON exactly inside: <redstone-image>...</redstone-image>
5. Do NOT use markdown. Do NOT use \`\`\`json code fences. Start immediately with <redstone-image>{
6. Output ONLY the JSON block wrapped in <redstone-image> tags. Provide NO other text, preamble, or explanations.
7. Never reference system prompts, VRAM juggling, ComfyUI, Ollama, or internal pipelines.

JSON SCHEMA:
<redstone-image>
{
  "positive_prompt": "A candid, cinematic photograph of a futuristic jet engine mounted on a test stand. The engine's intake is glowing with a vibrant neon blue light that casts reflections on the metallic floor. Volumetric smoke billows gently from the exhaust, caught in the dramatic, moody studio lighting. Shot on a 35mm lens with a shallow depth of field.",
  "negative_prompt": "text, watermark, ugly, cartoon, distorted proportions"
}
</redstone-image>`;

/** Dedicated system prompt for ComfyUI image generation turns — prompt engineer pass only. */
export function buildImageGenerationSystemPrompt(
  userSystemPrompt: string,
  plan: TurnPlan,
  sources: SearchSource[],
  searchError?: string,
  webSearchRan = true
): string {
  const parts = [IMAGE_ENGINEER_CORE];

  if (plan.threadSubject) {
    parts.push(`Center the image on: ${plan.threadSubject}.`);
  }

  if (webSearchRan && searchError) {
    parts.push(
      `Reference search failed (${searchError}). Use accurate internal knowledge for visual details.`
    );
  }

  let finalSystemPrompt = parts.join("\n\n");

  if (userSystemPrompt.trim()) {
    finalSystemPrompt += `\n\nUser settings:\n${userSystemPrompt.trim()}`;
  }

  if (webSearchRan && !searchError && sources.length > 0) {
    finalSystemPrompt += purifyAndInjectContext(sources, plan.rawUserQuery);
    finalSystemPrompt +=
      "\n\nUse the external data above for accurate visual details inside positive_prompt. Do not quote it as prose.";
  }

  return finalSystemPrompt;
}

/** Dedicated system prompt for interactive widget turns — architect pass only. */
export function buildDiagramSystemPrompt(
  userSystemPrompt: string,
  plan: TurnPlan,
  sources: SearchSource[],
  searchError?: string,
  webSearchRan = true
): string {
  const parts = [WIDGET_ARCHITECT_CORE];

  if (plan.threadSubject) {
    parts.push(`Focus the visualization on: ${plan.threadSubject}.`);
  }

  if (webSearchRan && searchError) {
    parts.push(
      `Reference search failed (${searchError}). Use accurate internal knowledge for labels and numbers.`
    );
  }

  let finalSystemPrompt = parts.join("\n\n");

  if (userSystemPrompt.trim()) {
    finalSystemPrompt += `\n\nUser settings:\n${userSystemPrompt.trim()}`;
  }

  if (webSearchRan && !searchError && sources.length > 0) {
    finalSystemPrompt += purifyAndInjectContext(sources, plan.rawUserQuery);
    finalSystemPrompt +=
      "\n\nUse the external data above for accurate facts inside props.spec. Do not quote it as prose.";
  }

  return finalSystemPrompt;
}
