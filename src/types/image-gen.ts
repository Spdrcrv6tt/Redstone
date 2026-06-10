export interface ImageGenerationSpec {
  positive_prompt: string;
  negative_prompt: string;
  /** Cached ComfyUI output URL (proxied) — persisted to skip regeneration on refresh. */
  url?: string;
}
