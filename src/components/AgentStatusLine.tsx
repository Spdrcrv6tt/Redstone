"use client";

interface AgentStatusLineProps {
  message: string;
}

export function AgentStatusLine({ message }: AgentStatusLineProps) {
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
      <span className="agent-status-text">{message}</span>
    </div>
  );
}
