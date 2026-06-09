"use client";

import type { AgentStatusMeta } from "@/types";

interface AgentStatusLineProps {
  status: AgentStatusMeta;
}

export function AgentStatusLine({ status }: AgentStatusLineProps) {
  return (
    <div className="agent-status-line" role="status" aria-live="polite">
      <span className="agent-status-dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="agent-status-dot"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <span className="agent-status-text">{status.message}</span>
    </div>
  );
}
