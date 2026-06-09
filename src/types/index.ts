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

export type SearchMode = "auto" | "always" | "never" | "aggressive";

export type AgentStatusPhase = "orchestrate" | "web" | "image" | "generate";

export interface AgentStatusMeta {
  message: string;
  phase: AgentStatusPhase;
}

export interface OrchestratorDecisionMeta {
  webSearch: boolean;
  webQuery: string;
  imageSearch: boolean;
  imageQuery: string;
  reason: string;
}

export interface SearchDecisionMeta {
  ran: boolean;
  reason: string;
  confidence?: string;
  routerUsed?: boolean;
  orchestrator?: OrchestratorDecisionMeta;
  mode: SearchMode;
}

export interface TurnDebugMeta {
  systemPrompt: string;
  upstreamMessages: OllamaChatMessage[];
  searchMs?: number;
  imageMs?: number;
}

export interface MessageSearchMeta {
  query: string;
  sources: SearchSource[];
  images: SearchImage[];
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

export interface AppSettings {
  ollamaHost: string;
  apiKey: string;
  braveApiKey: string;
  defaultModel: string;
  routerModel: string;
  searchMode: SearchMode;
  debugMode: boolean;
  streamResponses: boolean;
  systemPrompt: string;
  temperature: number;
  displayName: string;
}
