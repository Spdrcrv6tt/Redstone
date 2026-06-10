"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Message, MessageSearchMeta } from "@/types";

interface DebugPanelProps {
  message: Message;
  search?: MessageSearchMeta;
}

function Section({
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="debug-section">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="debug-section-header"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span>{title}</span>
        {badge && <span className="debug-badge">{badge}</span>}
      </button>
      {open && <div className="debug-section-body">{children}</div>}
    </div>
  );
}

function MonoBlock({ text }: { text: string }) {
  return (
    <pre className="debug-mono">
      <code>{text}</code>
    </pre>
  );
}

export function DebugPanel({ message, search }: DebugPanelProps) {
  const debug = search?.debug;
  const decision = search?.searchDecision;

  return (
    <div className="debug-panel">
      <p className="debug-panel-title">Debug trace</p>

      {decision && (
        <Section
          title="Web search"
          badge={decision.ran ? "ran" : "skipped"}
          defaultOpen
        >
          <MonoBlock
            text={[
              `Mode: ${decision.mode}`,
              `Ran: ${decision.ran}`,
              `Reason: ${decision.reason}`,
              decision.confidence
                ? `Confidence: ${decision.confidence}`
                : null,
              debug?.searchMs !== undefined
                ? `Search time: ${debug.searchMs}ms`
                : null,
              debug?.imageMs !== undefined
                ? `Image time: ${debug.imageMs}ms`
                : null,
              search?.query ? `Query: ${search.query}` : null,
              `Sources: ${search?.sources.length ?? 0}`,
              `Images: ${search?.images.length ?? 0}`,
            ]
              .filter(Boolean)
              .join("\n")}
          />
        </Section>
      )}

      {debug?.upstreamMessages && (
        <Section title="Sent to model" defaultOpen>
          <MonoBlock
            text={debug.upstreamMessages
              .map((m) => `--- ${m.role.toUpperCase()} ---\n${m.content}`)
              .join("\n\n")}
          />
        </Section>
      )}

      {message.content && (
        <Section title="Raw model output" defaultOpen>
          <MonoBlock text={message.content} />
        </Section>
      )}
    </div>
  );
}
