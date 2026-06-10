import type { OllamaChatMessage } from "@/types";
import type { SearchSource } from "@/types";

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type FocusKind = "person" | "mission" | "object";
export type AnswerStyle = "narrow" | "standard" | "narrative" | "exhaustive";
export type VisualMode = "none" | "show" | "requested-missing";

export interface FocusRef {
  kind: FocusKind;
  label: string;
}

export interface ConversationMemory {
  people: string[];
  missions: string[];
  objects: string[];
  /** Most recently mentioned person in the thread */
  recentPerson: string | null;
  /** What the last exchange was actually about */
  lastFocus: FocusRef | null;
}

export type PortraitVariant = "default" | "nasa_employee" | "official";

export interface ImageSearchPlan {
  queries: string[];
  matchTerms: string[];
  personNames: string[];
  avoidPeople: string[];
  preferPortrait: boolean;
  variant: PortraitVariant;
  excludeUrls: string[];
}

export type SearchConfidence = "high" | "low";

export interface SearchDecision {
  search: boolean;
  reason: string;
  confidence: SearchConfidence;
}

export interface TurnPlan {
  rawUserQuery: string;
  webSearchQuery: string;
  supplementalWebQueries: string[];
  answerStyle: AnswerStyle;
  visualMode: VisualMode;
  imageSearch: ImageSearchPlan | null;
  threadSubject: string | null;
  explicitVisualRequest: boolean;
  exhaustiveList: boolean;
  needsWebSearch: boolean;
  needsDiagram: boolean;
  searchDecision: SearchDecision;
}

/* ─── Entity extraction ─────────────────────────────────────────────────── */

const PERSON_BLOCK = new Set([
  "command",
  "pilot",
  "flight",
  "mission",
  "united",
  "north",
  "south",
  "gemini",
  "apollo",
  "other",
  "famous",
  "target",
  "the",
]);

function isPersonName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  if (parts.length !== 2) return false;
  if (parts.some((p) => /^[IVXLCDM]+$/.test(p))) return false;
  if (PERSON_BLOCK.has(parts[0].toLowerCase())) return false;
  return parts.every((p) => /^[A-Z][a-z]+(-[A-Z][a-z]+)?$/.test(p));
}

function extractMissions(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b([A-Za-z]+)\s+([IVXLCDM]{1,6})\b/g)) {
    out.push(`${m[1]} ${m[2]}`);
  }
  return out;
}

function extractVessels(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(
    /\b((?:USS|USNS|HMS|RV)\s+[\w][\w\s.-]{0,40})/gi
  )) {
    const name = m[1].trim().replace(/\s+/g, " ").replace(/[.,;:]+$/, "");
    if (name.length > 4) out.push(name);
  }
  return out;
}

function isVesselLabel(label: string): boolean {
  return /\b(?:USS|USNS|HMS|RV)\s+/i.test(label);
}

function extractPeople(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g)) {
    const start = m.index ?? 0;
    const prefix = text.slice(Math.max(0, start - 12), start);
    if (/\b(?:USS|USNS|HMS|RV)\s*$/i.test(prefix)) continue;
    if (isPersonName(m[1])) out.push(m[1]);
  }
  if (/\bNeil Armstrong\b/i.test(text)) out.push("Neil Armstrong");
  if (/\bDavid Scott\b/i.test(text)) out.push("David Scott");
  return out;
}

const PHYSICAL_NOUN =
  /\b(reactors?|nuclear\s+plants?|power\s+plants?|facilit(?:y|ies)|turbines?|generators?|engines?|dams?|bridges?|buildings?|structures?|machines?|vehicles?|spacecraft|rockets?|capsules?|landers?|rovers?|stations?|laborator(?:y|ies)|observator(?:y|ies))\b/gi;

function extractPhysicalTopics(text: string): string[] {
  const out: string[] = [];
  if (/\bSL-1\b/i.test(text)) out.push("SL-1 nuclear reactor Idaho");
  if (/\bThree Mile Island\b/i.test(text)) out.push("Three Mile Island nuclear plant");
  if (/\bChernobyl\b/i.test(text)) out.push("Chernobyl nuclear reactor");
  if (/\b(?:the\s+)?reactor\b/i.test(text)) {
    out.push("nuclear reactor");
  }
  if (
    /\b(?:the\s+)?(?:power\s+)?plant\b/i.test(text) &&
    !out.some((o) => /plant/i.test(o))
  ) {
    out.push("power plant");
  }
  for (const m of text.matchAll(
    /\b([A-Z][A-Za-z0-9-]*(?:\s+[A-Za-z0-9-]+){0,2})\s+(reactor|plant|facility)\b/g
  )) {
    const label = `${m[1]} ${m[2]}`;
    if (!out.some((o) => o.toLowerCase() === label.toLowerCase())) {
      out.push(label);
    }
  }
  for (const m of text.matchAll(PHYSICAL_NOUN)) {
    const term = m[0].toLowerCase();
    if (term.length > 4 && !out.some((o) => o.toLowerCase().includes(term))) {
      out.push(term);
    }
  }
  return out;
}

function isTopicAboutPhysical(query: string): boolean {
  if (!/\b(?:tell me about|what is (?:a |an |the )?|describe (?:the )?|explain (?:the )?)\b/i.test(query)) {
    return false;
  }
  if (extractPeople(query).length > 0) return false;
  return extractPhysicalTopics(query).length > 0 || PHYSICAL_NOUN.test(query);
}

function isSpaceObject(label: string): boolean {
  return /\b(agena|gatv|lunar module|saturn v|target vehicle|spacecraft|capsule|lander|rover)\b/i.test(
    label
  );
}

function extractObjects(text: string): string[] {
  const objects: string[] = [];
  if (/\bAgena\b/i.test(text)) objects.push("Agena target vehicle");
  if (/\bGATV\b/i.test(text)) objects.push("Gemini Agena target vehicle");
  if (/\bLunar Module\b/i.test(text)) objects.push("Lunar Module");
  if (/\bSaturn V\b/i.test(text)) objects.push("Saturn V rocket");
  if (/\btarget vehicle\b/i.test(text)) objects.push("target vehicle");
  objects.push(...extractPhysicalTopics(text));
  return objects;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

/** Build conversation memory + last focus from the thread. */
export function buildConversationMemory(
  messages: OllamaChatMessage[],
  latestUser: string
): ConversationMemory {
  const prior = messages.filter(
    (m, i, arr) =>
      !(
        i === arr.length - 1 &&
        m.role === "user" &&
        m.content.trim() === latestUser.trim()
      )
  );

  const people: string[] = [];
  const missions: string[] = [];
  const objects: string[] = [];

  for (const m of prior) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    people.push(...extractPeople(m.content));
    missions.push(...extractMissions(m.content));
    objects.push(...extractObjects(m.content));
    objects.push(...extractVessels(m.content));
  }

  const lastFocus = inferLastFocus(prior);

  return {
    people: unique(people),
    missions: unique(missions),
    objects: unique(objects),
    recentPerson: mostRecentPerson(prior),
    lastFocus,
  };
}

function mostRecentPerson(prior: OllamaChatMessage[]): string | null {
  for (let i = prior.length - 1; i >= 0; i--) {
    const m = prior[i];
    if (m.role !== "user" && m.role !== "assistant") continue;
    const found = extractPeople(m.content);
    if (found.length > 0) return found[found.length - 1];
  }
  return null;
}

function inferLastFocus(prior: OllamaChatMessage[]): FocusRef | null {
  const lastAssistant = [...prior].reverse().find((m) => m.role === "assistant");
  const lastUser = [...prior].reverse().find((m) => m.role === "user");
  const combined = `${lastUser?.content ?? ""} ${lastAssistant?.content ?? ""}`;

  if (/\bAgena\b/i.test(combined) || /\btarget vehicle\b/i.test(combined)) {
    return { kind: "object", label: "Agena target vehicle" };
  }

  const vessels = extractVessels(combined);
  if (vessels[0]) return { kind: "object", label: vessels[0] };

  const physical = extractPhysicalTopics(combined);
  if (physical[0]) return { kind: "object", label: physical[0] };

  const objs = extractObjects(combined);
  if (objs[0]) return { kind: "object", label: objs[0] };

  if (lastUser && EXPLICIT_VISUAL.test(lastUser.content) && lastAssistant) {
    const person = extractPeople(lastAssistant.content)[0];
    if (person) return { kind: "person", label: person };
  }

  if (lastUser && PERSON_WHO.test(lastUser.content)) {
    const person = extractPeople(lastAssistant?.content ?? combined)[0];
    if (person) return { kind: "person", label: person };
  }

  const mission = extractMissions(combined)[0];
  if (mission) return { kind: "mission", label: mission };

  const person = extractPeople(combined)[0];
  if (person) return { kind: "person", label: person };

  return null;
}

/* ─── Intent ────────────────────────────────────────────────────────────── */

type Intent =
  | "interactive_diagram"
  | "explicit_visual"
  | "narrow_fact"
  | "person_who"
  | "object_visual"
  | "follow_up"
  | "general";

/** Photo/image requests — bare "show me" intentionally excluded (diagrams use interactive_diagram). */
const EXPLICIT_VISUAL =
  /\b(?:(?:have|got|want|need|see|show|display)(?:\s+(?:me|a|an|any|his|her|their))?\s*(?:[\w']+\s+){0,3}?(?:photos?|images?|pictures?)|(?:show|display)\s+(?:his|her|their)\s+(?:[\w']+\s+){0,4}?(?:photos?|images?|pictures?)|(?:any|a|an)\s+(?:photos?|images?|pictures?)|(?:photo|picture|image)\s+of\b|(?:photo|picture)\s*(?:please|pls)?)\b/i;

const DEMANDS_INTERACTIVE_DIAGRAM =
  /(?:diagram|visualization|visualisation|interactive model|how .+ works visually|simulate|animate|visualize|visualise)/i;

const WRITES_HTML_PAGE =
  /\b(write|draft|create|build)\b[\s\S]{0,48}\b(html|landing page|web page|website)\b/i;

/** User wants an interactive in-chat diagram — not a photo search or markdown code dump. */
export function demandsInteractiveDiagram(query: string): boolean {
  const q = query.trim();
  if (!q || WRITES_HTML_PAGE.test(q)) return false;
  if (DEMANDS_INTERACTIVE_DIAGRAM.test(q)) return true;
  if (/\bshow\s+me\s+(?:an?\s+)?(?:interactive\s+)?diagram\b/i.test(q)) {
    return true;
  }
  if (/\b(?:learn|understand)\b[\s\S]{0,48}\b(?:visually|diagram)\b/i.test(q)) {
    return true;
  }
  return false;
}

const PERSON_PRONOUN =
  /\b(?:image|photo|picture)s?\s+of\s+(?:him|her|them)\b|\b(?:him|her|his|he|she)\b/i;

const NARROW_FACT =
  /\bwhat (?:was|is) the name of\b|\bwhat (?:was|is) (?:it|that) called\b|\bhow many\b|\bwhat year\b|\bwhen (?:did|was)\b/i;

const PERSON_WHO =
  /\bwho (?:was|is)\b|\bwhich (?:person|astronaut|pilot|commander)\b|\bcommander of\b|\bpilot of\b/i;

const OBJECT_VISUAL =
  /\b(?:what did .+ look like|target vehicle|spacecraft|rockets?|capsules?|landers?|rovers?|(?:USS|USNS|HMS|RV)\s+\w+|destroyers?|frigates?|aircraft carriers?|submarines?|warships?|reactors?|nuclear\s+plants?|power\s+plants?|facilit(?:y|ies))\b/i;

const FOLLOW_UP =
  /\b(?:what else|tell me more|his career|her career|their career|he |she |they |the mission)\b/i;

const EXHAUSTIVE_LIST =
  /\b(?:list|name|enumerate|give me)\s+(?:every|each|all|the)\b|\b(?:every|each|all)\s+(?:\w+\s+){0,4}(?:vessels?|ships?|names?|items?)\b|\bcomplete\s+list\b|\bfull\s+list\b|\blist\s+them\s+all\b/i;

export function isExhaustiveListQuery(query: string): boolean {
  return EXHAUSTIVE_LIST.test(query.trim());
}

function inferClassSubject(
  memory: ConversationMemory,
  messages: OllamaChatMessage[]
): string | null {
  const prior = messages.filter(
    (m, i, arr) =>
      !(
        i === arr.length - 1 &&
        m.role === "user"
      )
  );
  const combined = prior.map((m) => m.content).join(" ");

  if (/\bArleigh Burke[- ]class\b/i.test(combined)) {
    return "Arleigh Burke-class destroyers";
  }

  const vesselCandidates = [
    memory.lastFocus?.kind === "object" ? memory.lastFocus.label : null,
    ...memory.objects,
    ...extractVessels(combined),
  ].filter((v): v is string => !!v);

  for (const vessel of vesselCandidates) {
    if (/USS\s+Arleigh Burke/i.test(vessel)) {
      return "Arleigh Burke-class destroyers";
    }
  }

  const vessel = vesselCandidates.find((v) => isVesselLabel(v));
  if (vessel) {
    const core = vessel
      .replace(/^USS\s+/i, "")
      .replace(/\s*\(DDG-\d+\)/i, "")
      .trim();
    if (core) return `${core}-class vessels`;
  }

  return null;
}

function buildListSearchQueries(
  memory: ConversationMemory,
  messages: OllamaChatMessage[],
  raw: string
): string[] {
  const subject = inferClassSubject(memory, messages);
  if (!subject) {
    const anchor = memory.lastFocus?.label ?? memory.objects[0] ?? "";
    return [`${anchor} ${raw} complete list names`.trim().replace(/\s+/g, " ")];
  }

  return [
    `${subject} complete list all ships names hull numbers`,
    `List of ${subject} site:en.wikipedia.org`,
    `${subject} Flight I Flight II Flight IIA Flight III ships`,
  ];
}

function classifyIntent(query: string): Intent {
  const q = query.trim();
  if (demandsInteractiveDiagram(q)) return "interactive_diagram";
  if (EXPLICIT_VISUAL.test(q)) return "explicit_visual";
  if (NARROW_FACT.test(q)) return "narrow_fact";
  if (PERSON_WHO.test(q)) return "person_who";
  if (isTopicAboutPhysical(q)) return "object_visual";
  if (OBJECT_VISUAL.test(q)) return "object_visual";
  if (FOLLOW_UP.test(q)) return "follow_up";
  return "general";
}

/* ─── Web search gating ─────────────────────────────────────────────────── */

const EXPLICIT_SEARCH =
  /\b(?:search(?:\s+the\s+web)?|look\s+up|google|find\s+out|latest|current|breaking|news|today|this\s+week|recent(?:ly)?|as\s+of\s+\d{4}|up\s+to\s+date)\b/i;

/** Exact numeric/timestamp formatting — parametric memory is unreliable without RAG. */
const DEMANDS_EXACT_DATA =
  /(?:minute-by-minute|second-by-second|exact timeline|specific (?:dates|times|altitudes|numbers))/i;

export function demandsExactData(query: string): boolean {
  return DEMANDS_EXACT_DATA.test(query.trim());
}

const SKIP_SEARCH =
  /^(?:hi|hello|hey|thanks|thank\s+you|ok(?:ay)?|yes|no|sure|got\s+it|cool|nice)\b[!.,?\s]*$/i;

const CREATIVE_OR_LOCAL =
  /\b(?:write|rewrite|draft|compose|poem|story|joke|roleplay|translate|summarize\s+this|proofread|fix\s+this\s+code|debug|implement|refactor|explain\s+like|in\s+python|in\s+javascript|calculate|solve|what\s+is\s+\d+\s*[\+\-\*\/])\b/i;

function hasNamedAnchor(query: string): boolean {
  return (
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(query) ||
    /\b[A-Za-z]+ [IVXLCDM]{1,6}\b/.test(query) ||
    /\b(?:USS|USNS|HMS|RV)\s+[\w]/i.test(query) ||
    /\bSL-1\b/i.test(query)
  );
}

/** Heuristic: does this turn need a Brave web search? */
export function decideWebSearch(
  query: string,
  memory: ConversationMemory,
  intent: Intent,
  exhaustiveList: boolean
): SearchDecision {
  const q = query.trim();
  if (!q) {
    return { search: false, reason: "empty query", confidence: "high" };
  }

  if (exhaustiveList) {
    return { search: true, reason: "exhaustive list", confidence: "high" };
  }

  if (demandsExactData(q)) {
    return {
      search: true,
      reason: "high-density data request",
      confidence: "high",
    };
  }

  if (demandsInteractiveDiagram(q)) {
    return {
      search: true,
      reason: "interactive visualization requested",
      confidence: "high",
    };
  }

  if (EXPLICIT_SEARCH.test(q)) {
    return { search: true, reason: "explicit search intent", confidence: "high" };
  }

  if (SKIP_SEARCH.test(q)) {
    return { search: false, reason: "conversational", confidence: "high" };
  }

  if (CREATIVE_OR_LOCAL.test(q)) {
    return { search: false, reason: "creative or local task", confidence: "high" };
  }

  if (intent === "person_who" || intent === "explicit_visual") {
    return {
      search: true,
      reason: "person or explicit visual request",
      confidence: "high",
    };
  }

  if (intent === "object_visual" && !hasNamedAnchor(q)) {
    return {
      search: true,
      reason: "object topic without anchor in query",
      confidence: "high",
    };
  }

  if (needsWebContext(q)) {
    return {
      search: true,
      reason: "contextual follow-up or pronoun",
      confidence: "high",
    };
  }

  if (
    /\b(?:tell me about|what is|what was|who is|who was|describe|explain)\b/i.test(
      q
    ) &&
    (hasNamedAnchor(q) || PHYSICAL_NOUN.test(q))
  ) {
    return { search: true, reason: "entity lookup", confidence: "high" };
  }

  if (NARROW_FACT.test(q)) {
    return { search: true, reason: "narrow factual question", confidence: "high" };
  }

  if (memory.lastFocus && q.split(/\s+/).length <= 8) {
    return {
      search: false,
      reason: "short follow-up on established topic",
      confidence: "high",
    };
  }

  if (q.split(/\s+/).length <= 4 && !hasNamedAnchor(q)) {
    return { search: false, reason: "short general message", confidence: "high" };
  }

  return {
    search: false,
    reason: "no search signals — answering from model knowledge",
    confidence: "low",
  };
}

/* ─── Web search query ──────────────────────────────────────────────────── */

function needsWebContext(query: string): boolean {
  if (FOLLOW_UP.test(query)) return true;
  if (/\b(he|she|they|him|her|his|their|it)\b/i.test(query)) return true;
  if (/\bneil\b/i.test(query) && !/\bNeil [A-Z][a-z]+\b/.test(query)) return true;
  if (/\bthe (mission|commander|pilot|vehicle|spacecraft)\b/i.test(query)) {
    return true;
  }
  const hasAnchor =
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(query) ||
    /\b[A-Za-z]+ [IVXLCDM]{1,6}\b/.test(query);
  return !hasAnchor && query.split(/\s+/).length < 18;
}

export function buildWebSearchQuery(
  rawUser: string,
  memory: ConversationMemory
): string {
  const latest = rawUser.trim();
  if (!latest) return "";

  if (!needsWebContext(latest)) return latest.slice(0, 400);

  const parts: string[] = [];

  if (memory.lastFocus) parts.push(memory.lastFocus.label);
  else if (memory.people[0]) parts.push(memory.people[0]);

  if (/\b(career|accomplish|life|biography)\b/i.test(latest)) {
    parts.push("career accomplishments");
  }

  if (
    memory.missions[0] &&
    !latest.toLowerCase().includes(memory.missions[0].toLowerCase())
  ) {
    parts.push(memory.missions[0]);
  }

  parts.push(latest);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
}

/* ─── Image search plan ─────────────────────────────────────────────────── */

function objectFromSources(sources: SearchSource[]): string | null {
  const hay = sources
    .slice(0, 8)
    .map((s) => `${s.title} ${s.snippet}`)
    .join(" ");
  if (/\bAgena\b/i.test(hay)) return "Agena target vehicle";
  if (/\bGATV\b/i.test(hay)) return "Gemini Agena target vehicle";
  if (/\bLunar Module\b/i.test(hay)) return "Lunar Module";
  const physical = extractPhysicalTopics(hay);
  if (physical[0]) return physical[0];
  if (/\bSL-1\b/i.test(hay)) return "SL-1 nuclear reactor Idaho";
  if (/\bnuclear reactor\b/i.test(hay)) return "nuclear reactor";
  return null;
}

function allPeopleInSources(sources: SearchSource[]): string[] {
  const names = new Set<string>();
  for (const s of sources.slice(0, 8)) {
    for (const m of `${s.title} ${s.snippet}`.matchAll(
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g
    )) {
      if (isPersonName(m[1])) names.add(m[1]);
    }
  }
  return [...names];
}

function detectPortraitVariant(raw: string): PortraitVariant {
  if (/\b(nasa employee|employee photo|personnel photo|id photo)\b/i.test(raw)) {
    return "nasa_employee";
  }
  if (/\b(official (?:portrait|photo)|headshot)\b/i.test(raw)) {
    return "official";
  }
  return "default";
}

function imagePlanForPerson(
  name: string,
  avoidOthers: string[] = [],
  rawUser = "",
  excludeUrls: string[] = []
): ImageSearchPlan {
  const avoid = unique(
    avoidOthers.filter((p) => p.toLowerCase() !== name.toLowerCase())
  );
  const variant = detectPortraitVariant(rawUser);

  const queries: string[] =
    variant === "nasa_employee"
      ? [
          `"${name}" NASA official employee portrait site:nasa.gov`,
          `"${name}" Great Images in NASA portrait`,
        ]
      : variant === "official"
        ? [
            `"${name}" NASA official portrait photograph`,
            `"${name}" official headshot astronaut`,
          ]
        : [
            `"${name}" official portrait photograph`,
            `"${name}" NASA astronaut portrait`,
          ];

  return {
    queries,
    matchTerms: name.toLowerCase().split(/\s+/),
    personNames: [name],
    avoidPeople: avoid,
    preferPortrait: true,
    variant,
    excludeUrls,
  };
}

/** Person names mentioned in free text (titles, snippets). */
export function personNamesInText(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b([A-Za-z]+ [A-Za-z]+)\b/g)) {
    const cap = m[1]
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    if (isPersonName(cap)) out.push(cap);
  }
  return unique(out);
}

function imagePlanForVessel(
  label: string,
  excludeUrls: string[]
): ImageSearchPlan {
  const terms = label
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  return {
    queries: [
      `"${label}" US Navy official photo`,
      `${label} destroyer at sea photograph`,
    ],
    matchTerms: [...terms, label.toLowerCase()],
    personNames: [],
    avoidPeople: [],
    preferPortrait: false,
    variant: "default",
    excludeUrls,
  };
}

function imagePlanForTopic(
  label: string,
  excludeUrls: string[]
): ImageSearchPlan {
  const terms = label
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const queries = [`"${label}" photograph`, `${label} historical photo`];

  if (/\bSL-1\b/i.test(label)) {
    queries.unshift(
      "SL-1 nuclear reactor Idaho Falls photograph",
      "SL-1 reactor meltdown 1961 Idaho"
    );
  } else if (/\bnuclear reactor\b/i.test(label)) {
    queries.unshift(`${label} facility photograph`);
  }

  return {
    queries,
    matchTerms: [...terms, label.toLowerCase()],
    personNames: [],
    avoidPeople: [],
    preferPortrait: false,
    variant: "default",
    excludeUrls,
  };
}

function imagePlanForObject(
  label: string,
  mission: string | null,
  avoid: string[],
  excludeUrls: string[] = []
): ImageSearchPlan {
  const queries = [
    mission ? `${mission} ${label} NASA photograph` : `${label} NASA photograph`,
    `${label} NASA space`,
  ];
  const terms = [label.toLowerCase(), "nasa", ...(mission ? [mission.toLowerCase()] : [])];
  return {
    queries,
    matchTerms: terms,
    personNames: [],
    avoidPeople: avoid,
    preferPortrait: false,
    variant: "default",
    excludeUrls,
  };
}

function resolvePersonFromThread(
  rawUser: string,
  memory: ConversationMemory
): FocusRef | null {
  const fromQuery = extractPeople(rawUser);
  if (fromQuery[0]) return { kind: "person", label: fromQuery[0] };

  if (memory.lastFocus?.kind === "person") {
    return memory.lastFocus;
  }

  if (memory.recentPerson) {
    return { kind: "person", label: memory.recentPerson };
  }

  return null;
}

function resolveVisualSubject(
  intent: Intent,
  rawUser: string,
  memory: ConversationMemory,
  sources: SearchSource[]
): FocusRef | null {
  if (intent === "explicit_visual") {
    if (PERSON_PRONOUN.test(rawUser)) {
      return resolvePersonFromThread(rawUser, memory);
    }

    if (memory.lastFocus) return memory.lastFocus;
    if (memory.objects[0]) return { kind: "object", label: memory.objects[0] };
    if (memory.missions[0]) return { kind: "mission", label: memory.missions[0] };
    const fromWeb = objectFromSources(sources);
    if (fromWeb) return { kind: "object", label: fromWeb };
    if (memory.people[0]) return { kind: "person", label: memory.people[0] };
    return null;
  }

  if (intent === "person_who") {
    const fromQuery = extractPeople(rawUser);
    const fromSources = extractPeople(
      sources.map((s) => `${s.title} ${s.snippet}`).join(" ")
    );
    const name =
      fromQuery[0] ??
      memory.people[0] ??
      fromSources[0] ??
      (memory.lastFocus?.kind === "person" ? memory.lastFocus.label : null);
    if (name) return { kind: "person", label: name };
    return null;
  }

  if (intent === "object_visual") {
    const fromQuery =
      extractVessels(rawUser)[0] ?? extractPhysicalTopics(rawUser)[0];
    if (fromQuery) return { kind: "object", label: fromQuery };

    const sourceHay = sources.map((s) => `${s.title} ${s.snippet}`).join(" ");
    const label =
      extractVessels(sourceHay)[0] ??
      extractPhysicalTopics(sourceHay)[0] ??
      objectFromSources(sources) ??
      (memory.lastFocus?.kind === "object" ? memory.lastFocus.label : null) ??
      memory.objects[0];
    if (label) return { kind: "object", label };
    return null;
  }

  return null;
}

function buildImageSearchPlan(
  subject: FocusRef,
  memory: ConversationMemory,
  sources: SearchSource[],
  rawUser: string,
  priorImageUrls: string[]
): ImageSearchPlan {
  const avoid = allPeopleInSources(sources);
  const mission = memory.missions[0] ?? null;

  if (subject.kind === "person") {
    const others = unique([...allPeopleInSources(sources), ...memory.people]);
    return imagePlanForPerson(
      subject.label,
      others,
      rawUser,
      priorImageUrls
    );
  }

  if (isVesselLabel(subject.label)) {
    return imagePlanForVessel(subject.label, priorImageUrls);
  }

  if (isSpaceObject(subject.label)) {
    return imagePlanForObject(subject.label, mission, avoid, priorImageUrls);
  }

  return imagePlanForTopic(subject.label, priorImageUrls);
}

/* ─── Main entry ────────────────────────────────────────────────────────── */

export function planTurn(
  messages: OllamaChatMessage[],
  rawUserQuery: string,
  sources: SearchSource[] = [],
  priorImageUrls: string[] = []
): TurnPlan {
  const raw = rawUserQuery.trim();
  const memory = buildConversationMemory(messages, raw);
  const intent = classifyIntent(raw);
  const exhaustiveList = isExhaustiveListQuery(raw);

  let webSearchQuery = buildWebSearchQuery(raw, memory);
  let supplementalWebQueries: string[] = [];

  if (exhaustiveList) {
    const listQueries = buildListSearchQueries(memory, messages, raw);
    webSearchQuery = listQueries[0];
    supplementalWebQueries = listQueries.slice(1);
  }

  const needsDiagram = demandsInteractiveDiagram(raw);
  const explicitVisualRequest =
    intent === "explicit_visual" && !needsDiagram;
  const searchDecision = decideWebSearch(raw, memory, intent, exhaustiveList);

  let answerStyle: AnswerStyle = "standard";
  if (exhaustiveList) {
    answerStyle = "exhaustive";
  } else if (needsDiagram) {
    answerStyle = "narrative";
  } else if (NARROW_FACT.test(raw) || (PERSON_WHO.test(raw) && raw.split(/\s+/).length < 14)) {
    answerStyle = "narrow";
  } else if (intent === "follow_up" && /\b(career|story|history|full)\b/i.test(raw)) {
    answerStyle = "narrative";
  } else if (demandsExactData(raw)) {
    answerStyle = "narrative";
  }

  let visualMode: VisualMode = "none";
  let imageSearch: ImageSearchPlan | null = null;

  const shouldTryImage =
    !needsDiagram &&
    (explicitVisualRequest ||
      intent === "person_who" ||
      intent === "object_visual");

  if (shouldTryImage) {
    const subject = resolveVisualSubject(intent, raw, memory, sources);
    if (subject) {
      visualMode = "show";
      imageSearch = buildImageSearchPlan(
        subject,
        memory,
        sources,
        raw,
        priorImageUrls
      );
    } else if (explicitVisualRequest) {
      visualMode = "requested-missing";
    }
  }

  const threadSubject = exhaustiveList
    ? (inferClassSubject(memory, messages) ??
      memory.lastFocus?.label ??
      memory.objects[0] ??
      null)
    : (memory.lastFocus?.label ??
      memory.people[0] ??
      memory.missions[0] ??
      memory.objects[0] ??
      null);

  return {
    rawUserQuery: raw,
    webSearchQuery,
    supplementalWebQueries,
    answerStyle,
    visualMode,
    imageSearch,
    threadSubject,
    explicitVisualRequest,
    exhaustiveList,
    needsWebSearch: searchDecision.search,
    needsDiagram,
    searchDecision,
  };
}

/** After images are fetched, finalize visual mode for the prompt. */
export function finalizeVisualMode(
  plan: TurnPlan,
  imagesAttached: number
): VisualMode {
  if (plan.visualMode === "show" && imagesAttached === 0) {
    return plan.explicitVisualRequest ? "requested-missing" : "none";
  }
  if (imagesAttached > 0) return "show";
  return "none";
}
