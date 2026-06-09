import type { AgentStreamMeta } from "@/types";
import type { OrchestratorPhase } from "@/lib/search/orchestrator";

export interface AgentStatusEvent {
  message: string;
  phase: OrchestratorPhase;
}

export function encodeStatusLine(status: AgentStatusEvent): string {
  return JSON.stringify({ redstone_status: status }) + "\n";
}

export function encodeMetaLine(meta: AgentStreamMeta): string {
  return JSON.stringify({ redstone_meta: meta }) + "\n";
}
