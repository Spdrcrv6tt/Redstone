import {
  proxiedImagePath,
  remoteUrlFromProxy,
  verifyRemoteImageUrl,
} from "@/lib/image-proxy";
import {
  type ImageSearchPlan,
  personNamesInText,
} from "@/lib/search/coordinator";
import { needsUnconditionalDeepEnrich } from "@/lib/search/query-enhance";
import type { SearchImage, SearchSource } from "@/types";

const BRAVE_WEB = "https://api.search.brave.com/res/v1/web/search";
const BRAVE_IMAGES = "https://api.search.brave.com/res/v1/images/search";

const STOCK_DOMAINS = [
  "freepik.com",
  "shutterstock.com",
  "istockphoto.com",
  "gettyimages.com",
  "alamy.com",
  "dreamstime.com",
  "123rf.com",
  "stock.adobe.com",
  "depositphotos.com",
  "pixabay.com",
  "pexels.com",
];

const BRAVE_HEADERS = (apiKey: string) => ({
  Accept: "application/json",
  "Accept-Encoding": "gzip",
  "X-Subscription-Token": apiKey,
});

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveImageResult {
  title?: string;
  url?: string;
  source?: string;
  properties?: { url?: string; width?: number; height?: number };
  thumbnail?: { src?: string; width?: number; height?: number };
}

export interface BraveSearchBundle {
  sources: SearchSource[];
  images: SearchImage[];
  searchError?: string;
  imageError?: string;
}

function mergeSearchSources(
  batches: SearchSource[],
  max = 16
): SearchSource[] {
  const seen = new Set<string>();
  const merged: SearchSource[] = [];
  for (const source of batches) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    merged.push(source);
    if (merged.length >= max) break;
  }
  return merged;
}

/** Run multiple web searches and dedupe by URL. */
export async function executeWebSearches(
  queries: string[],
  apiKey: string,
  count = 8
): Promise<SearchSource[]> {
  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  if (!unique.length) return [];

  const batches = await Promise.all(
    unique.map((q) => braveWebSearch(q, apiKey, count))
  );
  return mergeSearchSources(batches.flat());
}

const LEXICAL_STOP_WORDS = new Set([
  "what",
  "were",
  "was",
  "the",
  "and",
  "for",
  "about",
  "tell",
  "give",
  "list",
  "who",
  "when",
  "where",
  "how",
  "why",
  "that",
  "this",
  "with",
  "from",
  "have",
  "has",
  "had",
  "are",
  "is",
  "of",
  "in",
  "on",
  "at",
  "to",
  "a",
  "an",
  "walk",
  "through",
  "during",
  "me",
  "official",
  "summary",
  "site",
  "nasa",
  "gov",
  "org",
  "wikipedia",
]);

function lexicalTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/site:\S+/g, " ")
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !LEXICAL_STOP_WORDS.has(w))
  );
}

/** Split a Wikipedia extract into paragraph chunks for lexical ranking. */
function splitExtractParagraphs(text: string): string[] {
  const raw = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const merged: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const block = raw[i] ?? "";
    const isHeading =
      block.length < 90 && !/[.,:;!?]/.test(block) && /^[A-Z]/.test(block);
    const next = raw[i + 1];
    if (isHeading && next) {
      merged.push(`${block}\n\n${next}`);
      i++;
    } else {
      merged.push(block);
    }
  }

  return merged.filter((p) => p.length >= 50);
}

/** Expand query terms with closely related words implied by the question. */
function expandedQueryTerms(query: string): string[] {
  const base = [...lexicalTerms(query)];
  const extra: string[] = [];
  const lower = query.toLowerCase();

  if (/\bexplosion\b/.test(lower)) {
    extra.push("bang", "accident", "rupture", "oxygen", "tank");
  }
  if (/\bsplashdown\b/.test(lower)) {
    extra.push("reentry", "recovery", "landing", "pacific");
  }
  if (/\bcrisis\b/.test(lower)) {
    extra.push("accident", "emergency", "failure");
  }
  if (/\b(timeline|sequence)\b/.test(lower)) {
    extra.push("hours", "minutes", "after", "approaching");
  }

  return [...new Set([...base, ...extra])];
}

function scoreParagraphByQueryTerms(
  paragraph: string,
  queryTerms: string[],
  baseTerms: Set<string>,
  docFreq: Map<string, number>,
  corpusSize: number,
  timelineQuery: boolean,
  userQuery: string
): number {
  const lower = paragraph.toLowerCase();
  let score = 0;

  for (const term of queryTerms) {
    if (!lower.includes(term)) continue;
    const df = docFreq.get(term) ?? 1;
    const idf = Math.log((corpusSize + 1) / (df + 1)) + 1;
    const specificity = Math.min(term.length / 4, 2.5);
    const weight = baseTerms.has(term) ? 1 : 0.6;
    const occurrences = lower.split(term).length - 1;
    score += idf * specificity * weight * Math.min(occurrences, 2);
  }

  if (timelineQuery && /\b\d{1,2}:\d{2}(:\d{2})?\b/.test(paragraph)) {
    score += 3;
  }

  if (
    /\b(movie|film|miniseries|dramatized)\b/i.test(paragraph) &&
    !/\b(movie|film|miniseries)\b/i.test(userQuery)
  ) {
    score *= 0.25;
  }

  return score;
}

/**
 * Rank paragraphs by lexical overlap with the user query (IDF-weighted term
 * scoring). Returns the top-K highest-scoring chunks instead of the article lead.
 */
export function rankExtractParagraphs(
  text: string,
  query: string,
  topK = 4
): string {
  const paragraphs = splitExtractParagraphs(text);
  if (!paragraphs.length) return text.trim();
  if (paragraphs.length <= topK) return paragraphs.join("\n\n");

  const baseTerms = new Set(lexicalTerms(query));
  const queryTerms = expandedQueryTerms(query);
  if (!queryTerms.length) return paragraphs.slice(0, topK).join("\n\n");

  const timelineQuery = needsUnconditionalDeepEnrich(query);
  const docFreq = new Map<string, number>();
  for (const term of queryTerms) {
    docFreq.set(
      term,
      paragraphs.filter((p) => p.toLowerCase().includes(term)).length
    );
  }

  const scored = paragraphs.map((para, index) => ({
    para,
    index,
    score: scoreParagraphByQueryTerms(
      para,
      queryTerms,
      baseTerms,
      docFreq,
      paragraphs.length,
      timelineQuery,
      query
    ),
  }));

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const top = scored.slice(0, topK).filter((s) => s.score > 0);
  if (!top.length) {
    return paragraphs.slice(0, topK).join("\n\n");
  }

  return top.map((s) => s.para).join("\n\n");
}

async function fetchWikipediaExtract(url: string): Promise<string | null> {
  if (!/wikipedia\.org\/wiki\//i.test(url)) return null;

  const title = decodeURIComponent(
    url.split("/wiki/")[1]?.split("#")[0]?.replace(/_/g, " ") ?? ""
  );
  if (!title) return null;

  const fetchOpts = {
    signal: AbortSignal.timeout(12_000),
    cache: "no-store" as const,
  };

  // REST plain endpoint returns the full article body, not intro-only extracts.
  try {
    const restUrl = `https://en.wikipedia.org/api/rest_v1/page/plain/${encodeURIComponent(title)}`;
    const restRes = await fetch(restUrl, fetchOpts);
    if (restRes.ok) {
      const plain = (await restRes.text()).trim();
      if (plain.length >= 200) return plain;
    }
  } catch {
    /* fall through to action API */
  }

  try {
    const api = new URL("https://en.wikipedia.org/w/api.php");
    api.searchParams.set("action", "query");
    api.searchParams.set("prop", "extracts");
    api.searchParams.set("explaintext", "1");
    api.searchParams.set("exsectionformat", "plain");
    // Do NOT set exintro — that limits to the lead summary only.
    api.searchParams.set("titles", title);
    api.searchParams.set("format", "json");

    const res = await fetch(api.toString(), fetchOpts);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      query?: { pages?: Record<string, { extract?: string }> };
    };
    const extract = Object.values(data.query?.pages ?? {})[0]?.extract?.trim();
    return extract && extract.length >= 200 ? extract : null;
  } catch {
    return null;
  }
}

/** Replace thin Brave preview snippets with full Wikipedia article text. */
export async function enrichSourcesWithDeepContent(
  sources: SearchSource[],
  userQuery = "",
  maxDepth = 4
): Promise<SearchSource[]> {
  const forceDeep = needsUnconditionalDeepEnrich(userQuery);

  const enriched = await Promise.all(
    sources.slice(0, maxDepth).map(async (source) => {
      if (!/wikipedia\.org/i.test(source.url)) return source;
      if (!forceDeep && source.snippet.length >= 300) return source;

      const extract = await fetchWikipediaExtract(source.url);
      if (!extract) return source;

      const topK = forceDeep ? 6 : 4;
      const ranked = rankExtractParagraphs(extract, userQuery, topK);

      return {
        ...source,
        title: `${source.title} (Wikipedia extract)`,
        snippet: ranked,
      };
    })
  );

  return [...enriched, ...sources.slice(maxDepth)];
}

/** Pull plain-text Wikipedia extract for list-style answers. */
export async function enrichSourcesForList(
  sources: SearchSource[]
): Promise<SearchSource[]> {
  const wiki = sources.find(
    (s) =>
      /wikipedia\.org/i.test(s.url) &&
      (/list of/i.test(`${s.title} ${s.url}`) ||
        /-class/i.test(`${s.title} ${s.url}`))
  );
  if (!wiki) return sources;

  const extract = await fetchWikipediaExtract(wiki.url);
  if (!extract) return sources;

  return sources.map((s) =>
    s.url === wiki.url
      ? {
          ...s,
          title: `${s.title} (Wikipedia extract)`,
          snippet: extract,
        }
      : s
  );
}

export async function braveWebSearch(
  query: string,
  apiKey: string,
  count = 8
): Promise<SearchSource[]> {
  const q = query.trim();
  if (!q) return [];
  if (!apiKey) throw new Error("Brave Search API key is not configured");

  const url = new URL(BRAVE_WEB);
  url.searchParams.set("q", q);
  url.searchParams.set("count", String(Math.min(count, 10)));

  const res = await fetch(url.toString(), {
    headers: BRAVE_HEADERS(apiKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Brave Search ${res.status}: ${text.slice(0, 200) || res.statusText}`
    );
  }

  const data = (await res.json()) as { web?: { results?: BraveWebResult[] } };
  return (data.web?.results ?? [])
    .filter((r) => r.url && r.title)
    .map((r) => ({
      title: r.title!,
      url: r.url!,
      snippet: r.description?.trim() || "",
    }));
}

export async function braveImageSearch(
  query: string,
  apiKey: string,
  count = 8
): Promise<SearchImage[]> {
  const q = query.trim();
  if (!q) return [];
  if (!apiKey) throw new Error("Brave Search API key is not configured");

  const url = new URL(BRAVE_IMAGES);
  url.searchParams.set("q", q);
  url.searchParams.set("count", String(Math.min(count, 10)));
  url.searchParams.set("safesearch", "strict");

  const res = await fetch(url.toString(), {
    headers: BRAVE_HEADERS(apiKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Brave Images ${res.status}: ${text.slice(0, 200) || res.statusText}`
    );
  }

  const data = (await res.json()) as { results?: BraveImageResult[] };

  return (data.results ?? [])
    .map((r) => parseImageResult(r))
    .filter((img): img is SearchImage => img !== null);
}

function isStock(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return STOCK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const MIN_SCORE = 8;
const PORTRAIT = /\b(portrait|official|headshot|photograph|photo|astronaut)\b/i;
const SCENE = /\b(crew|walk|walking|gantry|deck|ship|training|movie|still)\b/i;
const GENERIC_SPACE =
  /\b(earth|planet|orbit|curvature|from space|view of earth|solar|galaxy|nebula|iss view)\b/i;

function imageAlreadyShown(img: SearchImage, prior: string[]): boolean {
  if (!prior.length) return false;
  const candidates = [img.imageUrl, img.sourceUrl, img.thumbnailUrl].filter(
    Boolean
  );
  return candidates.some((url) => prior.includes(url));
}

function portraitImageMatches(img: SearchImage, plan: ImageSearchPlan): boolean {
  if (imageAlreadyShown(img, plan.excludeUrls)) return false;

  if (!plan.preferPortrait || !plan.personNames[0]) return true;

  if (isStock(img.sourceUrl)) return false;

  const hay = `${img.title} ${img.sourceUrl}`.toLowerCase();
  const target = plan.personNames[0].toLowerCase();

  if (!hay.includes(target)) return false;

  for (const avoid of plan.avoidPeople) {
    if (hay.includes(avoid.toLowerCase())) return false;
  }

  const named = personNamesInText(`${img.title} ${img.sourceUrl}`);
  if (named.some((n) => n.toLowerCase() !== target)) return false;

  if (plan.variant === "nasa_employee" && !hay.includes("nasa.gov")) {
    return false;
  }

  return true;
}

function scoreImage(img: SearchImage, plan: ImageSearchPlan): number {
  const hay = `${img.title} ${img.sourceUrl}`.toLowerCase();
  let score = 0;

  for (const term of plan.matchTerms) {
    if (term.length > 2 && hay.includes(term)) score += 9;
  }

  if (isStock(img.sourceUrl)) score -= 80;
  if (hay.includes("nasa.gov")) score += 22;

  for (const person of plan.avoidPeople) {
    if (hay.includes(person.toLowerCase())) score -= 38;
  }

  if (!plan.preferPortrait) {
    const area = imageArea(img.width, img.height);
    if (area >= 120_000) score += 24;
    else if (area >= 50_000) score += 12;
    else if (area > 0 && area < 36_000) score -= 20;
  }

  if (plan.preferPortrait && plan.personNames[0]) {
    const target = plan.personNames[0].toLowerCase();
    const hasFullName = hay.includes(target);

    score += hasFullName ? 32 : -60;
    if (PORTRAIT.test(hay)) score += 14;
    if (SCENE.test(hay)) score -= 18;
    if (GENERIC_SPACE.test(hay) && !hasFullName) score -= 50;
    if (hay.includes("nasa.gov") && !hasFullName) score -= 30;

    for (const avoid of plan.avoidPeople) {
      if (hay.includes(avoid.toLowerCase())) score -= 70;
    }

    const wrong = personNamesInText(`${img.title} ${img.sourceUrl}`).filter(
      (n) => n.toLowerCase() !== target
    );
    score -= wrong.length * 65;

    if (plan.variant === "nasa_employee") {
      if (hay.includes("nasa.gov")) score += 30;
      if (/\b(employee|personnel|official|portrait|headshot)\b/.test(hay)) {
        score += 12;
      }
    }
  }

  return score;
}

function titleSim(a: string, b: string): number {
  const ta = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
  const tb = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

function dedupeSimilar(images: SearchImage[]): SearchImage[] {
  const kept: SearchImage[] = [];
  for (const img of images) {
    const dup = kept.some(
      (k) =>
        k.imageUrl === img.imageUrl ||
        titleSim(k.title, img.title) > 0.72 ||
        (k.sourceUrl === img.sourceUrl && titleSim(k.title, img.title) > 0.4)
    );
    if (!dup) kept.push(img);
  }
  return kept;
}

function imageArea(width?: number, height?: number): number {
  return (width ?? 0) * (height ?? 0);
}

function looksLikeTinyThumb(url: string, width?: number, height?: number): boolean {
  const area = imageArea(width, height);
  if (area > 0 && area < 36_000) return true;
  return /thumbs\.|_small\d*\.|\/thumb(?:\/|s\/)/i.test(url);
}

function rankImages(
  candidates: SearchImage[],
  plan: ImageSearchPlan
): SearchImage[] {
  const eligible = dedupeSimilar(candidates).filter((img) =>
    portraitImageMatches(img, plan)
  );
  const ranked = eligible
    .map((img) => ({ img, score: scoreImage(img, plan) }))
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 0) return ranked.map(({ img }) => img);

  if (!plan.preferPortrait && eligible.length > 0) {
    return eligible
      .map((img) => ({ img, score: scoreImage(img, plan) }))
      .filter(({ img, score }) => score > 0 && !isStock(img.sourceUrl))
      .sort((a, b) => b.score - a.score)
      .map(({ img }) => img);
  }

  return [];
}

function remotesForImage(img: SearchImage): string[] {
  const out: string[] = [];
  for (const proxy of [img.imageUrl, img.thumbnailUrl]) {
    const remote = remoteUrlFromProxy(proxy);
    if (remote && !out.includes(remote)) out.push(remote);
  }
  return out;
}

async function resolveVerifiedImages(
  candidates: SearchImage[],
  plan: ImageSearchPlan
): Promise<SearchImage[]> {
  const ranked = rankImages(candidates, plan);
  const verified: {
    img: SearchImage;
    remote: string;
    area: number;
    score: number;
  }[] = [];

  for (const img of ranked.slice(0, 10)) {
    const score = scoreImage(img, plan);
    for (const remote of remotesForImage(img)) {
      if (!(await verifyRemoteImageUrl(remote))) continue;
      verified.push({
        img,
        remote,
        area: imageArea(img.width, img.height),
        score,
      });
      break;
    }
  }

  if (!verified.length) return [];

  verified.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.area - a.area;
  });

  const best = verified[0];
  const thumbRemote =
    remoteUrlFromProxy(best.img.thumbnailUrl) ??
    remoteUrlFromProxy(best.img.imageUrl) ??
    best.remote;

  return [
    {
      ...best.img,
      imageUrl: proxiedImagePath(best.remote),
      thumbnailUrl: proxiedImagePath(thumbRemote),
    },
  ];
}

function parseImageResult(r: BraveImageResult): SearchImage | null {
  const propsUrl = r.properties?.url;
  const thumbUrl = r.thumbnail?.src;
  let rawImage = propsUrl ?? thumbUrl;
  let rawThumb = thumbUrl ?? propsUrl;

  if (propsUrl && thumbUrl) {
    const propsTiny = looksLikeTinyThumb(
      propsUrl,
      r.properties?.width,
      r.properties?.height
    );
    const thumbArea = imageArea(r.thumbnail?.width, r.thumbnail?.height);
    const propsArea = imageArea(r.properties?.width, r.properties?.height);
    if (propsTiny || (thumbArea > propsArea && thumbArea > 0)) {
      rawImage = thumbUrl;
      rawThumb = propsUrl;
    }
  }

  if (!rawImage) return null;

  const width =
    rawImage === thumbUrl
      ? (r.thumbnail?.width ?? r.properties?.width)
      : (r.properties?.width ?? r.thumbnail?.width);
  const height =
    rawImage === thumbUrl
      ? (r.thumbnail?.height ?? r.properties?.height)
      : (r.properties?.height ?? r.thumbnail?.height);

  return {
    title: r.title?.trim() || r.source || "Image",
    imageUrl: proxiedImagePath(rawImage),
    thumbnailUrl: proxiedImagePath(rawThumb ?? rawImage),
    sourceUrl: r.url ?? "",
    width,
    height,
  };
}

/** Execute web search, then optional image search from a unified turn plan. */
export async function executeSearch(
  webQuery: string,
  imagePlan: ImageSearchPlan | null,
  apiKey: string,
  options?: { skipWeb?: boolean }
): Promise<BraveSearchBundle> {
  const bundle: BraveSearchBundle = { sources: [], images: [] };

  if (!options?.skipWeb && webQuery.trim()) {
    try {
      bundle.sources = await braveWebSearch(webQuery, apiKey, 8);
    } catch (err) {
      bundle.searchError =
        err instanceof Error ? err.message : "Web search failed";
    }
  }

  if (!imagePlan) return bundle;

  try {
    const batches = await Promise.all(
      imagePlan.queries
        .slice(0, 2)
        .map((q) => braveImageSearch(q, apiKey, 8))
    );
    const seen = new Set<string>();
    const flat = batches.flat().filter((img) => {
      if (seen.has(img.imageUrl)) return false;
      seen.add(img.imageUrl);
      return true;
    });
    bundle.images = await resolveVerifiedImages(flat, imagePlan);
  } catch (err) {
    bundle.imageError =
      err instanceof Error ? err.message : "Image search failed";
  }

  return bundle;
}

export function resolveBraveApiKey(fromBody?: string): string {
  return (
    (typeof fromBody === "string" && fromBody.trim()) ||
    process.env.BRAVE_SEARCH_API_KEY ||
    ""
  );
}
