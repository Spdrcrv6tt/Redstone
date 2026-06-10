import { NextRequest, NextResponse } from "next/server";
import { SERVER_OLLAMA_HOST, CORS_HEADERS } from "@/lib/proxy";
import { getComfyUIWorkflow } from "@/lib/comfy-workflow";
import {
  cancelPendingLlmWarm,
  evictAllOllamaModels,
  pollComfyCompletion,
  scheduleLlmWarm,
  waitForComfyQueueIdle,
  waitForOllamaUnload,
  withGenerationLock,
} from "@/lib/vram-juggler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Local ComfyUI runs can exceed default serverless limits. */
export const maxDuration = 600;

const COMFYUI_URL =
  process.env.COMFYUI_URL?.trim() || "http://127.0.0.1:8188";
const DEFAULT_LLM_MODEL =
  process.env.VRAM_JUGGLER_MODEL?.trim() || "gemma2:27b";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function proxyImageUrl(image: {
  filename: string;
  subfolder?: string;
  type?: string;
}): string {
  const params = new URLSearchParams({ filename: image.filename });
  if (image.type) params.set("type", image.type);
  if (image.subfolder) params.set("subfolder", image.subfolder);
  return `/api/comfy-output?${params.toString()}`;
}

async function runGeneration(input: {
  positive_prompt: string;
  negative_prompt: string;
  llmModel: string;
}): Promise<{ url: string }> {
  const ollamaUrl = SERVER_OLLAMA_HOST.replace(/\/+$/, "");
  const comfyUrl = COMFYUI_URL.replace(/\/+$/, "");

  console.log("Evicting all Ollama models from VRAM...");
  cancelPendingLlmWarm();
  await evictAllOllamaModels(ollamaUrl);

  const unloaded = await waitForOllamaUnload(ollamaUrl);
  if (!unloaded) {
    console.warn(
      "Ollama models still loaded after eviction — ComfyUI may be slow or stall"
    );
  }

  const queueReady = await waitForComfyQueueIdle(comfyUrl);
  if (!queueReady) {
    throw new Error(
      "ComfyUI queue is busy — wait for the current job to finish and try again"
    );
  }

  console.log("Submitting to ComfyUI...");
  const comfyWorkflow = getComfyUIWorkflow(
    input.positive_prompt,
    input.negative_prompt
  );

  const comfyRes = await fetch(`${comfyUrl}/prompt`, {
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

  const imageMeta = await pollComfyCompletion(comfyUrl, promptId);

  // Default: no Gemma preload — ComfyUI keeps diffusion weights resident.
  // Set VRAM_JUGGLER_AUTO_WARM=true for a delayed, guarded preload (60s).
  scheduleLlmWarm(ollamaUrl, input.llmModel, comfyUrl);

  return { url: proxyImageUrl(imageMeta) };
}

export async function POST(req: NextRequest) {
  let llmModel = DEFAULT_LLM_MODEL;

  try {
    const body = (await req.json()) as {
      positive_prompt?: string;
      negative_prompt?: string;
      model?: string;
    };

    const positive_prompt = body.positive_prompt?.trim();
    const negative_prompt =
      body.negative_prompt?.trim() ||
      "text, watermark, ugly, cartoon, distorted proportions";

    if (!positive_prompt) {
      return NextResponse.json(
        { error: "positive_prompt is required" },
        { status: 400 }
      );
    }

    llmModel = body.model?.trim() || DEFAULT_LLM_MODEL;

    const result = await withGenerationLock(() =>
      runGeneration({ positive_prompt, negative_prompt, llmModel })
    );

    return NextResponse.json(result);
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
