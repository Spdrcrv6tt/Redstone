import type { CanvasDocument, EngineMode } from "@/types/canvas";

export type {
  CanvasDocument,
  CanvasPatch,
  CanvasViewportContext,
  EngineMode,
} from "@/types/canvas";

export type Role = "user" | "assistant" | "system";
export type Theme = "light" | "dark";

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Blob URL for image previews in the UI */
  previewUrl?: string;
  /** Raw base64 (no data-URL prefix) for Ollama vision models */
  base64?: string;
  /** Extracted text for plain-text files */
  textContent?: string;
}

export interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchImage {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  width?: number;
  height?: number;
}

export type SearchMode = "auto" | "always" | "never";

export type AgentPipelineStatus =
  | "routing"
  | "searching"
  | "injecting"
  | "generating";

export interface AgentStatusMeta {
  redstone_status: AgentPipelineStatus;
  message: string;
}

export interface SearchDecisionMeta {
  ran: boolean;
  reason: string;
  confidence?: string;
  mode: SearchMode;
}

export interface TurnDebugMeta {
  /** Deprecated: use upstreamMessages[0] — kept optional to avoid duplicate payloads. */
  systemPrompt?: string;
  upstreamMessages: OllamaChatMessage[];
  searchMs?: number;
  imageMs?: number;
}

export interface SearchVideo {
  title: string;
  videoId: string;
  url: string;
  thumbnailUrl: string;
  channelName?: string;
}

export interface SearchLink {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface MessageSearchMeta {
  query: string;
  sources: SearchSource[];
  images: SearchImage[];
  videos?: SearchVideo[];
  links?: SearchLink[];
  searchError?: string;
  imageError?: string;
  searchDecision?: SearchDecisionMeta;
  debug?: TurnDebugMeta;
}

/** Server stream metadata (same shape as MessageSearchMeta). */
export type AgentStreamMeta = MessageSearchMeta;

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  model?: string;
  isStreaming?: boolean;
  error?: string;
  attachments?: MessageAttachment[];
  /** Live pipeline status while the turn is in progress */
  agentStatus?: AgentStatusMeta;
  /** Web search data for this assistant turn (not shown as a tool call) */
  search?: MessageSearchMeta;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: number;
  updatedAt: number;
  /** Irreversible — once "canvas", always spatial workspace for this chat. */
  engineMode?: EngineMode;
  /** Spatial workspace document (canvas conversations). */
  canvas?: CanvasDocument;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

export interface OllamaChatMessage {
  role: Role;
  content: string;
  images?: string[];
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_ctx?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponseChunk {
  model: string;
  created_at: string;
  message: {
    role: Role;
    content: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export type ThinkingOrbPath = "circular" | "triangular" | "atom" | "star4";

export interface ThinkingOrbSettings {
  count: number;
  speed: number;
  radius: number;
  path: ThinkingOrbPath;
  colors: string[];
}

export interface AppSettings {
  ollamaHost: string;
  localOllamaHost: string;
  apiKey: string;
  braveApiKey: string;
  defaultModel: string;
  searchMode: SearchMode;
  debugMode: boolean;
  streamResponses: boolean;
  systemPrompt: string;
  temperature: number;
  /** Ollama `num_ctx` — max tokens in the model context window. */
  numCtx: number;
  displayName: string;
  thinkingOrbs: ThinkingOrbSettings;
}
