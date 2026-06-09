"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Code2,
} from "lucide-react";
import { buildWebPreviewDocument } from "@/lib/markdown-code";

interface LivePreviewProps {
  id: string;
  markdown: string;
  defaultOpen?: boolean;
}

export function LivePreview({
  id,
  markdown,
  defaultOpen = true,
}: LivePreviewProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [refreshKey, setRefreshKey] = useState(0);

  const srcdoc = useMemo(
    () => buildWebPreviewDocument(markdown),
    [markdown, refreshKey]
  );

  const openInNewTab = useCallback(() => {
    const blob = new Blob([srcdoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [srcdoc]);

  return (
    <div id={id} className="live-preview">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="live-preview-toggle"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-primary">Live preview</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted bg-surface-muted px-1.5 py-0.5 rounded">
            HTML · CSS · JS
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="live-preview-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="live-preview-toolbar">
              <span className="text-[11px] text-muted">Sandboxed render</span>
              <div className="flex items-center gap-1">
                <PreviewAction
                  onClick={() => setRefreshKey((k) => k + 1)}
                  title="Refresh preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </PreviewAction>
                <PreviewAction onClick={openInNewTab} title="Open in new tab">
                  <ExternalLink className="w-3.5 h-3.5" />
                </PreviewAction>
                <PreviewAction onClick={() => setOpen(false)} title="Hide preview">
                  <EyeOff className="w-3.5 h-3.5" />
                </PreviewAction>
              </div>
            </div>
            <div className="live-preview-frame-wrap">
              <iframe
                key={refreshKey}
                title="Live HTML preview"
                sandbox="allow-scripts allow-modals allow-forms"
                srcDoc={srcdoc}
                className="live-preview-frame"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="live-preview-show-btn"
        >
          <Eye className="w-3.5 h-3.5" />
          Show live preview
        </button>
      )}
    </div>
  );
}

function PreviewAction({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="code-block-btn"
    >
      {children}
    </button>
  );
}
