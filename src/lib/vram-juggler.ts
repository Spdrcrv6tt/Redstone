const OLLAMA_PS_POLL_MS = 500;
const OLLAMA_UNLOAD_TIMEOUT_MS = 45_000;
const COMFY_QUEUE_POLL_MS = 1500;
const COMFY_QUEUE_TIMEOUT_MS = 30_000;
const COMFY_HISTORY_POLL_MS = 2000;
const COMFY_GENERATION_TIMEOUT_MS = 8 * 60 * 1000;
const COMFY_STALL_MS = 3 * 60 * 1000;
/** Only used when VRAM_JUGGLER_AUTO_WARM=true — long delay so ComfyUI keeps full VRAM. */
const POST_COMFY_WARM_DELAY_MS = 60_000;

let generationActive = false;
let pendingWarmTimer: ReturnType<typeof setTimeout> | null = null;

interface OllamaPsModel {
  name: string;
}

interface ComfyQueueItem {
  prompt_id?: string;
  [key: string]: unknown;
}

interface ComfyQueueResponse {
  queue_running?: ComfyQueueItem[];
  queue_pending?: ComfyQueueItem[];
}

interface ComfyHistoryImage {
  filename: string;
  subfolder?: string;
  type?: string;
}

interface ComfyHistoryEntry {
  status?: { status_str?: string; completed?: boolean };
  outputs?: Record<string, { images?: ComfyHistoryImage[] }>;
}

let generationChain: Promise<void> = Promise.resolve();

export function isGenerationActive(): boolean {
  return generationActive;
}

/** Cancel any scheduled Ollama preload — call before evicting VRAM. */
export function cancelPendingLlmWarm(): void {
  if (pendingWarmTimer) {
    clearTimeout(pendingWarmTimer);
    pendingWarmTimer = null;
  }
}

/** Serialize image generations so two jobs never fight for VRAM. */
export async function withGenerationLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = generationChain.then(async () => {
    generationActive = true;
    cancelPendingLlmWarm();
    try {
      return await fn();
    } finally {
      generationActive = false;
    }
  });
  generationChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listLoadedOllamaModels(
  ollamaUrl: string
): Promise<string[]> {
  const data = await fetchJson<{ models?: OllamaPsModel[] }>(
    `${ollamaUrl}/api/ps`
  );
  return (data?.models ?? []).map((m) => m.name).filter(Boolean);
}

/** Unload every model Ollama currently has in VRAM. */
export async function evictAllOllamaModels(ollamaUrl: string): Promise<void> {
  const models = await listLoadedOllamaModels(ollamaUrl);
  const targets = new Set(models);

  if (targets.size === 0) return;

  await Promise.all(
    [...targets].map((model) =>
      fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, keep_alive: 0 }),
      }).catch(() => undefined)
    )
  );
}

/** Poll until Ollama reports no loaded models or timeout. */
export async function waitForOllamaUnload(
  ollamaUrl: string,
  timeoutMs = OLLAMA_UNLOAD_TIMEOUT_MS
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const loaded = await listLoadedOllamaModels(ollamaUrl);
    if (loaded.length === 0) return true;
    await sleep(OLLAMA_PS_POLL_MS);
  }
  return (await listLoadedOllamaModels(ollamaUrl)).length === 0;
}

/**
 * Optionally preload the chat LLM after image generation.
 * Disabled by default — ComfyUI keeps diffusion weights resident, so preloading
 * Gemma competes for VRAM and slows sampling. Ollama loads lazily on next chat.
 */
export function scheduleLlmWarm(
  ollamaUrl: string,
  model: string,
  comfyUrl?: string
): void {
  if (process.env.VRAM_JUGGLER_AUTO_WARM !== "true") return;

  cancelPendingLlmWarm();
  pendingWarmTimer = setTimeout(() => {
    pendingWarmTimer = null;
    void runLlmWarmIfSafe(ollamaUrl, model, comfyUrl);
  }, POST_COMFY_WARM_DELAY_MS);
}

async function runLlmWarmIfSafe(
  ollamaUrl: string,
  model: string,
  comfyUrl?: string
): Promise<void> {
  if (generationActive) return;

  if (comfyUrl) {
    const idle = await waitForComfyQueueIdle(comfyUrl, 5000);
    if (!idle || generationActive) return;
  }

  const loaded = await listLoadedOllamaModels(ollamaUrl);
  if (loaded.length > 0 || generationActive) return;

  await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: " ", keep_alive: "1h" }),
  }).catch(() => undefined);
}

/** Wait until ComfyUI has no running or pending jobs. */
export async function waitForComfyQueueIdle(
  comfyUrl: string,
  timeoutMs = COMFY_QUEUE_TIMEOUT_MS
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const queue = await fetchJson<ComfyQueueResponse>(`${comfyUrl}/queue`);
    const running = queue?.queue_running?.length ?? 0;
    const pending = queue?.queue_pending?.length ?? 0;
    if (running === 0 && pending === 0) return true;
    await sleep(COMFY_QUEUE_POLL_MS);
  }
  return false;
}

function extractImageFromHistory(
  history: Record<string, ComfyHistoryEntry>,
  promptId: string
): ComfyHistoryImage | null {
  const entry = history[promptId];
  if (!entry?.outputs) return null;

  for (const output of Object.values(entry.outputs)) {
    const image = output.images?.[0];
    if (image?.filename) return image;
  }
  return null;
}

function isPromptStillQueued(
  queue: ComfyQueueResponse | null,
  promptId: string
): boolean {
  if (!queue) return false;
  const inRunning = (queue.queue_running ?? []).some(
    (item) => item.prompt_id === promptId
  );
  const inPending = (queue.queue_pending ?? []).some(
    (item) => item.prompt_id === promptId
  );
  return inRunning || inPending;
}

export async function pollComfyCompletion(
  comfyUrl: string,
  promptId: string,
  options?: {
    timeoutMs?: number;
    stallMs?: number;
    onProgress?: (message: string) => void;
  }
): Promise<ComfyHistoryImage> {
  const timeoutMs = options?.timeoutMs ?? COMFY_GENERATION_TIMEOUT_MS;
  const stallMs = options?.stallMs ?? COMFY_STALL_MS;
  const deadline = Date.now() + timeoutMs;
  let lastQueuedAt = Date.now();

  while (Date.now() < deadline) {
    const queue = await fetchJson<ComfyQueueResponse>(`${comfyUrl}/queue`);
    const stillQueued = isPromptStillQueued(queue, promptId);

    if (stillQueued) {
      lastQueuedAt = Date.now();
      const running = queue?.queue_running?.[0];
      if (running?.prompt_id === promptId) {
        options?.onProgress?.("ComfyUI is sampling…");
      } else {
        options?.onProgress?.("Waiting in ComfyUI queue…");
      }
    } else if (Date.now() - lastQueuedAt > stallMs) {
      const history = await fetchJson<Record<string, ComfyHistoryEntry>>(
        `${comfyUrl}/history/${promptId}`
      );
      const image = history ? extractImageFromHistory(history, promptId) : null;
      if (image) return image;
      throw new Error(
        "ComfyUI stopped processing without producing an image (possible VRAM stall)"
      );
    }

    const history = await fetchJson<Record<string, ComfyHistoryEntry>>(
      `${comfyUrl}/history/${promptId}`
    );
    const image = history ? extractImageFromHistory(history, promptId) : null;
    if (image) return image;

    const entry = history?.[promptId];
    if (entry?.status?.status_str === "error") {
      throw new Error("ComfyUI reported a generation error");
    }

    await sleep(COMFY_HISTORY_POLL_MS);
  }

  throw new Error("ComfyUI generation timed out");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
