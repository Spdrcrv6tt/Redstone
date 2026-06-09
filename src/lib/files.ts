import type { MessageAttachment } from "@/types";
import { generateId } from "@/lib/utils";

export const MAX_FILE_SIZE = 8 * 1024 * 1024;
export const MAX_FILES = 6;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".json", ".csv", ".xml",
  ".html", ".htm", ".js", ".ts", ".tsx", ".jsx", ".py",
  ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h",
  ".css", ".scss", ".yaml", ".yml", ".toml", ".sql",
  ".sh", ".bash", ".zsh", ".env", ".log",
]);

function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json") return true;
  return TEXT_EXTENSIONS.has(getExtension(file.name));
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

export async function processFile(file: File): Promise<MessageAttachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  const base: MessageAttachment = {
    id: generateId(),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };

  if (IMAGE_TYPES.has(file.type) || file.type.startsWith("image/")) {
    const base64 = await readAsBase64(file);
    return {
      ...base,
      base64,
      previewUrl: URL.createObjectURL(file),
    };
  }

  if (isTextFile(file)) {
    const textContent = await readAsText(file);
    return { ...base, textContent };
  }

  throw new Error(
    `${file.name}: unsupported type. Attach images or text-based files.`
  );
}

export async function processFiles(files: File[]): Promise<MessageAttachment[]> {
  if (files.length > MAX_FILES) {
    throw new Error(`Maximum ${MAX_FILES} files per message`);
  }
  return Promise.all(files.map(processFile));
}

/** Merge text-file contents into the message body for the API */
export function buildMessageContent(
  content: string,
  attachments: MessageAttachment[]
): string {
  const textBlocks = attachments
    .filter((a) => a.textContent)
    .map((a) => `[File: ${a.name}]\n${a.textContent}`);

  if (!textBlocks.length) return content;
  const prefix = textBlocks.join("\n\n");
  return content ? `${prefix}\n\n${content}` : prefix;
}

/** Extract base64 image payloads for Ollama vision */
export function extractImages(attachments: MessageAttachment[]): string[] {
  return attachments
    .filter((a) => a.base64 && a.mimeType.startsWith("image/"))
    .map((a) => a.base64!);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
