"use client";

import { useEffect, useRef } from "react";
import { MessageItem } from "@/components/MessageItem";
import type { Conversation } from "@/types";
import { Bot, Flame } from "lucide-react";

interface MessageListProps {
  conversation: Conversation | null;
}

export function MessageList({ conversation }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    const el = containerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Flame className="w-8 h-8 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">Redstone</h2>
          <p className="text-zinc-500 text-sm max-w-xs">
            Select a model and start a new conversation to begin.
          </p>
        </div>
      </div>
    );
  }

  if (conversation.messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <Bot className="w-6 h-6 text-zinc-400" />
        </div>
        <div>
          <p className="text-zinc-400 font-medium">{conversation.model}</p>
          <p className="text-zinc-600 text-sm mt-1">Send a message to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto py-4 space-y-1">
      {conversation.messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
