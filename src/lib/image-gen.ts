import type { ImageGenerationSpec } from "@/types/image-gen";

const IMAGE_OPEN_RE = /<redstone-image\s*>/i;
const IMAGE_CLOSE_RE = /<\/redstone-image\s*>/i;
const IMAGE_BLOCK_RE =
  /<redstone-image\s*>([\s\S]*?)<\/redstone-image\s*>/gi;

const PLACEHOLDER_PREFIX = "\u0000REDSTONE_IMAGE_";
const PLACEHOLDER_SUFFIX = "\u0000";

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseImageGenerationSpec(
  raw: string
): ImageGenerationSpec | null {
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

  const positive =
    typeof record.positive_prompt === "string"
      ? record.positive_prompt.trim()
      : "";
  const negative =
    typeof record.negative_prompt === "string"
      ? record.negative_prompt.trim()
      : "";

  if (!positive) return null;

  const url =
    typeof record.url === "string" && record.url.trim()
      ? record.url.trim()
      : undefined;

  return {
    positive_prompt: positive,
    negative_prompt: negative || "low quality, blurry, text, watermark",
    ...(url ? { url } : {}),
  };
}

/** Shield image payloads from prose cleaners. */
export function protectImageBlocks(text: string): {
  text: string;
  restore: (cleaned: string) => string;
} {
  const blocks: string[] = [];
  const shielded = text.replace(
    /<redstone-image\s*>[\s\S]*?(?:<\/redstone-image\s*>|$)/gi,
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
        /\u0000REDSTONE_IMAGE_(\d+)\u0000/g,
        (_, index) => blocks[Number(index)] ?? ""
      ),
  };
}

/** Persist generated image URL into the nth <redstone-image> block. */
export function embedGeneratedImageUrl(
  content: string,
  imageIndex: number,
  url: string
): string {
  let index = 0;
  return content.replace(IMAGE_BLOCK_RE, (match, payload: string) => {
    if (index !== imageIndex) {
      index++;
      return match;
    }
    index++;

    const spec = parseImageGenerationSpec(payload);
    if (!spec || spec.url) return match;

    const enriched = { ...spec, url };
    return `<redstone-image>${JSON.stringify(enriched)}</redstone-image>`;
  });
}

export function stripImageBlocks(text: string): string {
  return text
    .replace(IMAGE_BLOCK_RE, "\n[generated image]\n")
    .replace(/<redstone-image\s*>[\s\S]*$/i, "")
    .trim();
}

export {
  IMAGE_OPEN_RE,
  IMAGE_CLOSE_RE,
  IMAGE_BLOCK_RE,
};
