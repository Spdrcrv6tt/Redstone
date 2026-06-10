/**
 * ComfyUI workflow in API format.
 * Export your pipeline from ComfyUI (Dev mode → Save API Format) and replace this object.
 * Map positive/negative prompts into CLIPTextEncode node `text` inputs.
 */
export function getComfyUIWorkflow(pos: string, neg: string): Record<string, unknown> {
  return {
    "3": {
      inputs: {
        seed: Math.floor(Math.random() * 1_000_000_000_000),
        steps: 28,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
      class_type: "KSampler",
    },
    "4": {
      inputs: {
        ckpt_name: "sd_xl_base_1.0.safetensors",
      },
      class_type: "CheckpointLoaderSimple",
    },
    "5": {
      inputs: {
        width: 1024,
        height: 1024,
        batch_size: 1,
      },
      class_type: "EmptyLatentImage",
    },
    "6": {
      inputs: {
        text: pos,
        clip: ["4", 1],
      },
      class_type: "CLIPTextEncode",
    },
    "7": {
      inputs: {
        text: neg,
        clip: ["4", 1],
      },
      class_type: "CLIPTextEncode",
    },
    "8": {
      inputs: {
        samples: ["3", 0],
        vae: ["4", 2],
      },
      class_type: "VAEDecode",
    },
    "9": {
      inputs: {
        filename_prefix: "redstone",
        images: ["8", 0],
      },
      class_type: "SaveImage",
    },
  };
}
