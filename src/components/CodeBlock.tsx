"use client";

import { useState, useCallback } from "react";
import {
  Copy,
  Check,
  WrapText,
  AlignLeft,
  Eye,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { isWebLang } from "@/lib/markdown-code";

interface CodeBlockProps {
  lang: string | null;
  code: string;
  previewTargetId?: string;
  children: React.ReactNode;
  preProps: React.HTMLAttributes<HTMLPreElement>;
}

export function CodeBlock({
  lang,
  code,
  previewTargetId,
  children,
  preProps,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [wrapped, setWrapped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const scrollToPreview = useCallback(() => {
    if (!previewTargetId) return;
    const el = document.getElementById(previewTargetId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el?.classList.add("live-preview-highlight");
    setTimeout(() => el?.classList.remove("live-preview-highlight"), 1200);
  }, [previewTargetId]);

  const showPreviewBtn = isWebLang(lang) && previewTargetId;

  return (
    <div
      className={[
        "code-block",
        expanded ? "code-block-expanded" : "",
      ].join(" ")}
    >
      <div className="code-block-header">
        <span className="code-block-lang">{lang ?? "text"}</span>
        <div className="code-block-actions">
          {showPreviewBtn && (
            <ToolbarButton onClick={scrollToPreview} title="Jump to live preview">
              <Eye className="w-3.5 h-3.5" />
            </ToolbarButton>
          )}
          <ToolbarButton
            onClick={() => setWrapped((v) => !v)}
            title={wrapped ? "Disable line wrap" : "Enable line wrap"}
            active={wrapped}
          >
            {wrapped ? (
              <WrapText className="w-3.5 h-3.5" />
            ) : (
              <AlignLeft className="w-3.5 h-3.5" />
            )}
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Collapse" : "Expand"}
            active={expanded}
          >
            {expanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </ToolbarButton>
          <ToolbarButton onClick={copy} title="Copy code">
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </ToolbarButton>
        </div>
      </div>
      <pre
        {...preProps}
        className={[preProps.className, wrapped ? "code-block-wrapped" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </pre>
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  children,
  active,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "code-block-btn",
        active ? "code-block-btn-active" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
