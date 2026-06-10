import type { AgentPipelineStatus, AgentStreamMeta } from "@/types";

export interface AgentStatusEvent {
  redstone_status: AgentPipelineStatus;
  message: string;
}

export function encodeStatusLine(status: AgentStatusEvent): string {
  return JSON.stringify(status) + "\n";
}

export function encodeMetaLine(meta: AgentStreamMeta): string {
  return JSON.stringify({ redstone_meta: meta }) + "\n";
}
