/** AuraFlow + Qwen text encoder workflow (ComfyUI API format). */
export function getComfyUIWorkflow(
  positive_prompt: string,
  negative_prompt: string
): Record<string, unknown> {
  return {
    "9": {
      inputs: {
        filename_prefix: "z-image",
        images: ["76:65", 0],
      },
      class_type: "SaveImage",
    },
    "76:67": {
      inputs: {
        text: positive_prompt,
        clip: ["76:62", 0],
      },
      class_type: "CLIPTextEncode",
    },
    "76:68": {
      inputs: {
        width: 1280,
        height: 720,
        batch_size: 1,
      },
      class_type: "EmptySD3LatentImage",
    },
    "76:63": {
      inputs: {
        vae_name: "ae.safetensors",
      },
      class_type: "VAELoader",
    },
    "76:62": {
      inputs: {
        clip_name: "qwen_3_4b.safetensors",
        type: "lumina2",
        device: "default",
      },
      class_type: "CLIPLoader",
    },
    "76:65": {
      inputs: {
        samples: ["76:69", 0],
        vae: ["76:63", 0],
      },
      class_type: "VAEDecode",
    },
    "76:70": {
      inputs: {
        shift: 3,
        model: ["76:66", 0],
      },
      class_type: "ModelSamplingAuraFlow",
    },
    "76:66": {
      inputs: {
        unet_name: "z_image_bf16.safetensors",
        weight_dtype: "default",
      },
      class_type: "UNETLoader",
    },
    "76:71": {
      inputs: {
        text: negative_prompt,
        clip: ["76:62", 0],
      },
      class_type: "CLIPTextEncode",
    },
    "76:69": {
      inputs: {
        seed: Math.floor(Math.random() * 1_000_000_000_000_000),
        steps: 31,
        cfg: 4.4,
        sampler_name: "res_multistep",
        scheduler: "simple",
        denoise: 1,
        model: ["76:70", 0],
        positive: ["76:67", 0],
        negative: ["76:71", 0],
        latent_image: ["76:68", 0],
      },
      class_type: "KSampler",
    },
  };
}
