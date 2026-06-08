"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, AlertCircle, User, Bot } from "lucide-react";
import type { Message } from "@/types";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === "user";

  return (
    <div className={`group flex gap-3 px-4 py-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          isUser
            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
            : "bg-zinc-700 text-zinc-300 border border-zinc-600"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        {/* Error state */}
        {message.error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 mb-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{message.error}</span>
          </div>
        )}

        {/* Content */}
        {message.content && (
          <div
            className={`relative rounded-2xl px-4 py-3 text-sm max-w-[85%] ${
              isUser
                ? "bg-orange-500/15 border border-orange-500/20 text-zinc-100"
                : "bg-zinc-800/60 border border-zinc-700/50 text-zinc-100"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700 prose-code:text-orange-300 prose-code:bg-zinc-900/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Streaming cursor */}
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-orange-400 rounded-sm ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}

        {/* Empty streaming state */}
        {!message.content && message.isStreaming && (
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-2xl px-4 py-3">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        )}

        {/* Actions */}
        {!message.isStreaming && message.content && !isUser && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={copy}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {message.model && (
              <span className="text-xs text-zinc-600 px-2">{message.model}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
