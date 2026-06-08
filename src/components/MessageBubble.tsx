"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, AlertCircle, Sparkles } from "lucide-react";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  index: number;
}

export function MessageBubble({ message, index }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className={`flex gap-3 px-5 py-2 group ${isUser ? "flex-row-reverse" : "flex-row"}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: index === 0 ? 0 : 0 }}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
          style={{
            background: "rgba(249,115,22,0.12)",
            border: "1px solid rgba(249,115,22,0.18)",
          }}
        >
          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
        </div>
      )}

      {/* Content */}
      <div className={`flex flex-col max-w-[78%] gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        {/* Error banner */}
        {message.error && (
          <div
            className="flex items-center gap-2 text-sm text-red-400 px-4 py-2.5 rounded-xl"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.18)",
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs">{message.error}</span>
          </div>
        )}

        {/* Bubble */}
        {message.content && (
          <div
            className="rounded-2xl px-4 py-3 text-sm leading-relaxed relative overflow-hidden"
            style={
              isUser
                ? {
                    background: "rgba(249,115,22,0.1)",
                    border: "1px solid rgba(249,115,22,0.16)",
                    borderBottomRightRadius: "6px",
                    boxShadow: "inset 0 1px 0 rgba(249,115,22,0.08)",
                  }
                : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderTopLeftRadius: "6px",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    backdropFilter: "blur(12px)",
                  }
            }
          >
            {/* Top-edge shine for AI bubble */}
            {!isUser && (
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            )}

            {isUser ? (
              <p className="text-zinc-100 whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none text-zinc-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Streaming cursor */}
            {message.isStreaming && (
              <span
                className="inline-block w-[3px] h-[1.1em] rounded-full ml-0.5 align-text-bottom"
                style={{
                  background: "rgba(249,115,22,0.9)",
                  animation: "pulse-glow 0.8s ease-in-out infinite",
                }}
              />
            )}
          </div>
        )}

        {/* Empty streaming state */}
        {!message.content && message.isStreaming && (
          <div
            className="px-4 py-3 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderTopLeftRadius: "6px",
            }}
          >
            <div className="flex gap-1.5 items-center">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full bg-zinc-500"
                  style={{ animation: `pulse-glow 1.2s ease-in-out ${delay}ms infinite` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Copy button — AI only */}
        {!isUser && !message.isStreaming && message.content && (
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs text-zinc-700 hover:text-zinc-400 px-2 py-1 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
            style={{ background: "transparent" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </motion.div>
  );
}
