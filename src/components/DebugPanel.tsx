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
              decision.routerUsed ? "Router model consulted: yes" : null,
              debug?.searchMs !== undefined
                ? `Search time: ${debug.searchMs}ms`
                : null,
              debug?.imageMs !== undefined
                ? `Image time: ${debug.imageMs}ms`
                : null,
              debug?.synopsisMs !== undefined
                ? `Synopsis time: ${debug.synopsisMs}ms`
                : null,
              search?.query ? `Query: ${search.query}` : null,
              decision.orchestrator
                ? [
                    `Watchdog web: ${decision.orchestrator.webSearch}`,
                    decision.orchestrator.webQuery
                      ? `Watchdog web query: ${decision.orchestrator.webQuery}`
                      : null,
                    `Watchdog image: ${decision.orchestrator.imageSearch}`,
                    decision.orchestrator.imageQuery
                      ? `Watchdog image query: ${decision.orchestrator.imageQuery}`
                      : null,
                    decision.orchestrator.synopsis
                      ? `Watchdog synopsis: ✓ (${decision.orchestrator.synopsis.length} chars)`
                      : null,
                    decision.orchestrator.synopsisError
                      ? `Synopsis error: ${decision.orchestrator.synopsisError}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("\n")
                : null,
              `Sources: ${search?.sources.length ?? 0}`,
              `Images: ${search?.images.length ?? 0}`,
            ]
              .filter(Boolean)
              .join("\n")}
          />
        </Section>
      )}

      {decision?.orchestrator?.watchdogRaw && (
        <Section title="Watchdog decision (raw JSON)">
          <MonoBlock text={decision.orchestrator.watchdogRaw} />
        </Section>
      )}

      {decision?.orchestrator?.synopsis && (
        <Section title="Watchdog briefing (sent to model)" defaultOpen>
          <MonoBlock text={decision.orchestrator.synopsis} />
        </Section>
      )}

      {debug?.upstreamMessages && (
        <Section title="Sent to model">
          <MonoBlock
            text={debug.upstreamMessages
              .map((m) => `--- ${m.role.toUpperCase()} ---\n${m.content}`)
              .join("\n\n")}
          />
        </Section>
      )}

      {debug?.systemPrompt && (
        <Section title="System prompt">
          <MonoBlock text={debug.systemPrompt} />
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
