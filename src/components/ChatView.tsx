"use client";

import { useAppStore } from "@/lib/store";
import { useChat } from "@/hooks/useChat";
import { MessageList } from "@/components/MessageList";
import { InputBar } from "@/components/InputBar";
import { ModelSelector } from "@/components/ModelSelector";
import { PanelLeft } from "lucide-react";

export function ChatView() {
  const { activeConversationId, sidebarOpen, setSidebarOpen, settings } = useAppStore();
  const { sendMessage, stop, conversation } = useChat(activeConversationId);

  const isStreaming =
    conversation?.messages.some((m) => m.isStreaming) ?? false;

  const hasModel = !!(conversation?.model || settings.defaultModel);

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Topbar */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <ModelSelector conversationId={activeConversationId ?? undefined} />
        <div className="flex-1" />
        {conversation && (
          <span className="text-xs text-zinc-600 hidden sm:block truncate max-w-48">
            {conversation.title}
          </span>
        )}
      </header>

      {/* Messages */}
      <MessageList conversation={conversation ?? null} />

      {/* Input */}
      <InputBar
        onSend={sendMessage}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!hasModel || !activeConversationId}
      />
    </div>
  );
}
