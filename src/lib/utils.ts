import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Short label for the composer pill — "llama3.2:latest" → "llama3.2" */
export function formatModelLabel(name: string): string {
  const base = name.split(":")[0];
  return base.length > 18 ? `${base.slice(0, 16)}…` : base;
}
