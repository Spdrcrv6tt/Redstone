import type {
  FlashcardDeckSpec,
  StudyQuizSpec,
} from "@/types/study";

const FLASHCARDS_BLOCK_RE =
  /<redstone-flashcards\s*>([\s\S]*?)<\/redstone-flashcards\s*>/gi;
const QUIZ_BLOCK_RE =
  /<redstone-quiz\s*>([\s\S]*?)<\/redstone-quiz\s*>/gi;

const PLACEHOLDER_PREFIX = "\u0000REDSTONE_STUDY_";
const PLACEHOLDER_SUFFIX = "\u0000";

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseFlashcardDeck(raw: string): FlashcardDeckSpec | null {
  const trimmed = stripJsonFences(raw.trim());
  if (!trimmed.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const title =
    typeof record.title === "string" ? record.title.trim() : "Flashcards";
  const cardsRaw = record.cards;
  if (!Array.isArray(cardsRaw) || cardsRaw.length === 0) return null;

  const cards = cardsRaw
    .map((card) => {
      if (!card || typeof card !== "object") return null;
      const c = card as Record<string, unknown>;
      const front = typeof c.front === "string" ? c.front.trim() : "";
      const back = typeof c.back === "string" ? c.back.trim() : "";
      if (!front || !back) return null;
      return { front, back };
    })
    .filter((c): c is { front: string; back: string } => c !== null);

  if (!cards.length) return null;
  return { title, cards };
}

export function parseStudyQuiz(raw: string): StudyQuizSpec | null {
  const trimmed = stripJsonFences(raw.trim());
  if (!trimmed.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const title =
    typeof record.title === "string" ? record.title.trim() : "Practice Quiz";
  const questionsRaw = record.questions;
  if (!Array.isArray(questionsRaw) || questionsRaw.length === 0) return null;

  const questions = questionsRaw
    .map((q) => {
      if (!q || typeof q !== "object") return null;
      const item = q as Record<string, unknown>;
      const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
      const choices = Array.isArray(item.choices)
        ? item.choices
            .filter((c): c is string => typeof c === "string" && !!c.trim())
            .map((c) => c.trim())
        : [];
      const answerIndex =
        typeof item.answerIndex === "number" ? item.answerIndex : -1;
      if (!prompt || choices.length < 2) return null;
      if (answerIndex < 0 || answerIndex >= choices.length) return null;
      const explanation =
        typeof item.explanation === "string"
          ? item.explanation.trim()
          : undefined;
      return { prompt, choices, answerIndex, ...(explanation ? { explanation } : {}) };
    })
    .filter((q): q is StudyQuizSpec["questions"][number] => q !== null);

  if (!questions.length) return null;
  return { title, questions };
}

/** Shield study tool payloads from prose cleaners. */
export function protectStudyBlocks(text: string): {
  text: string;
  restore: (cleaned: string) => string;
} {
  const blocks: string[] = [];
  const shielded = text.replace(
    /<redstone-(?:flashcards|quiz)\s*>[\s\S]*?(?:<\/redstone-(?:flashcards|quiz)\s*>|$)/gi,
    (match) => {
      const id = blocks.length;
      blocks.push(match);
      return `${PLACEHOLDER_PREFIX}${id}${PLACEHOLDER_SUFFIX}`;
    }
  );

  return {
    text: shielded,
    restore: (cleaned: string) =>
      cleaned.replace(
        /\u0000REDSTONE_STUDY_(\d+)\u0000/g,
        (_, index) => blocks[Number(index)] ?? ""
      ),
  };
}

export function stripStudyBlocks(text: string): string {
  return text
    .replace(FLASHCARDS_BLOCK_RE, "\n[flashcard deck]\n")
    .replace(QUIZ_BLOCK_RE, "\n[practice quiz]\n")
    .replace(/<redstone-(?:flashcards|quiz)\s*>[\s\S]*$/i, "")
    .trim();
}

export const STUDY_OPEN_TAGS = [
  { tag: "redstone-flashcards", open: /<redstone-flashcards\s*>/i, close: /<\/redstone-flashcards\s*>/i },
  { tag: "redstone-quiz", open: /<redstone-quiz\s*>/i, close: /<\/redstone-quiz\s*>/i },
] as const;
