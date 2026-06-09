"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check, FileText, RotateCcw, Globe } from "lucide-react";
import { LivePreview } from "@/components/LivePreview";
import { AssistantArticle } from "@/components/AssistantArticle";
import { SearchImagePreloader } from "@/components/SearchImages";
import { cleanSearchResponse, plainSearchResponse } from "@/lib/search/citations";
import { formatFileSize } from "@/lib/files";
import { hasWebPreview } from "@/lib/markdown-code";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
}

export function MessageBubble({
  message,
  onRegenerate,
  showRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const previewId = `live-preview-${message.id}`;
  const showLivePreview =
    !isUser && !!message.content && hasWebPreview(message.content);
  const searchSources = message.search?.sources ?? [];
  const searchImages = message.search?.images ?? [];
  const hasSearchImages = searchImages.length > 0;
  const assistantContent =
    !isUser && message.content ? cleanSearchResponse(message.content) : "";

  const [imageReady, setImageReady] = useState(!hasSearchImages);

  useEffect(() => {
    if (!hasSearchImages) {
      setImageReady(true);
      return;
    }
    setImageReady(false);
  }, [message.id, hasSearchImages]);

  const isPending =
    message.isStreaming || (hasSearchImages && !imageReady);
  const canRevealBody = !!assistantContent && !isPending;

  const copy = async () => {
    const text = !isUser && message.content
      ? plainSearchResponse(message.content)
      : message.content;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.error) {
    return (
      <motion.div
        className="px-4 sm:px-0 py-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-sm text-red-500 bg-red-500/10 rounded-2xl px-4 py-3 border border-red-500/20">
          {message.error}
        </p>
        {showRegenerate && onRegenerate && (
          <ActionBar
            onCopy={copy}
            copied={copied}
            onRegenerate={onRegenerate}
            showRegenerate
          />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`group py-3 ${isUser ? "flex justify-end" : ""} ${message.isStreaming ? "message-streaming" : ""}`}
      initial={isUser ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className={
          isUser
            ? "max-w-[min(85%,520px)]"
            : "w-full"
        }
      >
        {message.attachments && message.attachments.length > 0 && (
          <div
            className={`flex flex-wrap gap-2 mb-2 ${isUser ? "justify-end" : ""}`}
          >
            {message.attachments.map((att) =>
              att.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={att.id}
                  src={att.previewUrl}
                  alt={att.name}
                  className="max-w-[200px] max-h-[160px] rounded-2xl object-cover border border-theme"
                />
              ) : (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-muted border border-theme text-left"
                >
                  <FileText className="w-4 h-4 text-secondary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-primary">{att.name}</p>
                    <p className="text-[10px] text-muted">
                      {formatFileSize(att.size)}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {isUser && message.content && (
          <div className="inline-block text-left px-5 py-3 rounded-[22px] rounded-br-[6px] user-bubble leading-relaxed whitespace-pre-wrap shadow-sm">
            {message.content}
          </div>
        )}

        {!isUser && (
          <div className="leading-[1.75] text-primary">
            {hasSearchImages && !imageReady && (
              <SearchImagePreloader
                images={searchImages}
                onReady={() => setImageReady(true)}
              />
            )}

            <AnimatePresence initial={false}>
              {canRevealBody ? (
                <motion.div
                  key={`reveal-${message.id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 1.6,
                    ease: [0.4, 0, 0.2, 1],
                    opacity: { duration: 1.6, ease: "linear" },
                    y: { duration: 1.6, ease: [0.4, 0, 0.2, 1] },
                  }}
                >
                  <AssistantArticle
                    content={assistantContent}
                    images={searchImages}
                    searchSources={searchSources}
                    previewTargetId={
                      showLivePreview ? previewId : undefined
                    }
                  />
                  {showLivePreview && (
                    <LivePreview
                      id={previewId}
                      markdown={assistantContent}
                      defaultOpen
                    />
                  )}
                </motion.div>
              ) : isPending ? (
                <motion.div
                  key="loading"
                  className="py-2 space-y-2"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                >
                  <p className="text-[11px] text-muted flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-indigo-500 animate-pulse" />
                    Searching the web…
                  </p>
                  <div className="flex gap-1.5">
                    {[0, 160, 320].map((delay) => (
                      <span
                        key={delay}
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: "var(--text-muted)",
                          animation: `dot-pulse 1.4s ease-in-out ${delay}ms infinite`,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

          </div>
        )}

        {/* User copy on hover */}
        {isUser && message.content && (
          <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ActionButton onClick={copy} title="Copy">
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </ActionButton>
          </div>
        )}

        {!isUser && !message.isStreaming && assistantContent && (
          <ActionBar
            onCopy={copy}
            copied={copied}
            onRegenerate={onRegenerate}
            showRegenerate={showRegenerate}
          />
        )}
      </div>
    </motion.div>
  );
}

function ActionBar({
  onCopy,
  copied,
  onRegenerate,
  showRegenerate,
}: {
  onCopy: () => void;
  copied: boolean;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
      {showRegenerate && onRegenerate && (
        <ActionButton onClick={onRegenerate} title="Regenerate">
          <RotateCcw className="w-3.5 h-3.5" />
        </ActionButton>
      )}
      <ActionButton onClick={onCopy} title="Copy">
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </ActionButton>
    </div>
  );
}

function ActionButton({
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
      onClick={onClick}
      title={title}
      className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors"
    >
      {children}
    </button>
  );
}
