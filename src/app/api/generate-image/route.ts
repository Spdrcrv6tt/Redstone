import { NextRequest, NextResponse } from "next/server";
import { SERVER_OLLAMA_HOST, CORS_HEADERS } from "@/lib/proxy";
import { getComfyUIWorkflow } from "@/lib/comfy-workflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COMFYUI_URL =
  process.env.COMFYUI_URL?.trim() || "http://127.0.0.1:8188";
const DEFAULT_LLM_MODEL =
  process.env.VRAM_JUGGLER_MODEL?.trim() || "gemma2:27b";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const VRAM_CLEAR_DELAY_MS = 2000;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface ComfyHistoryImage {
  filename: string;
  subfolder?: string;
  type?: string;
}

interface ComfyHistoryEntry {
  outputs?: Record<
    string,
    { images?: ComfyHistoryImage[] }
  >;
}

async function evictLlmFromVram(ollamaUrl: string, model: string) {
  await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, keep_alive: 0 }),
  });
}

async function warmLlmInVram(ollamaUrl: string, model: string) {
  fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: "", keep_alive: "1h" }),
  }).catch(() => undefined);
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

function proxyImageUrl(image: ComfyHistoryImage): string {
  const params = new URLSearchParams({ filename: image.filename });
  if (image.type) params.set("type", image.type);
  if (image.subfolder) params.set("subfolder", image.subfolder);
  return `/api/comfy-output?${params.toString()}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      positive_prompt?: string;
      negative_prompt?: string;
      model?: string;
    };

    const positive_prompt = body.positive_prompt?.trim();
    const negative_prompt =
      body.negative_prompt?.trim() ||
      "low quality, blurry, text, watermark, ugly, cartoon, 3d render, distorted proportions";

    if (!positive_prompt) {
      return NextResponse.json(
        { error: "positive_prompt is required" },
        { status: 400 }
      );
    }

    const ollamaUrl = SERVER_OLLAMA_HOST.replace(/\/+$/, "");
    const llmModel = body.model?.trim() || DEFAULT_LLM_MODEL;

    console.log("Evicting LLM from VRAM...");
    await evictLlmFromVram(ollamaUrl, llmModel);

    await new Promise((resolve) => setTimeout(resolve, VRAM_CLEAR_DELAY_MS));

    console.log("Submitting to ComfyUI...");
    const comfyWorkflow = getComfyUIWorkflow(positive_prompt, negative_prompt);

    const comfyRes = await fetch(`${COMFYUI_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: comfyWorkflow }),
    });

    if (!comfyRes.ok) {
      const detail = await comfyRes.text().catch(() => "");
      throw new Error(detail || `ComfyUI prompt failed (${comfyRes.status})`);
    }

    const { prompt_id: promptId } = (await comfyRes.json()) as {
      prompt_id?: string;
    };
    if (!promptId) {
      throw new Error("ComfyUI returned no prompt_id");
    }

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let imageMeta: ComfyHistoryImage | null = null;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const historyRes = await fetch(`${COMFYUI_URL}/history/${promptId}`);
      if (!historyRes.ok) continue;

      const history = (await historyRes.json()) as Record<
        string,
        ComfyHistoryEntry
      >;
      imageMeta = extractImageFromHistory(history, promptId);
      if (imageMeta) break;
    }

    if (!imageMeta) {
      throw new Error("ComfyUI generation timed out");
    }

    console.log("Reloading LLM into VRAM...");
    void warmLlmInVram(ollamaUrl, llmModel);

    return NextResponse.json({ url: proxyImageUrl(imageMeta) });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Image generation failed",
      },
      { status: 500 }
    );
  }
}
