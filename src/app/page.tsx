"use client";

import { useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useChat } from "@/hooks/useChat";
import { BackgroundEffects } from "@/components/BackgroundEffects";
import { TopBar } from "@/components/TopBar";
import { ChatSidebar } from "@/components/ChatSidebar";
import { LandingHero } from "@/components/LandingHero";
import { MessageBubble } from "@/components/MessageBubble";
import { InputComposer } from "@/components/InputComposer";
import { SettingsModal } from "@/components/SettingsModal";
import { StoreHydrator } from "@/components/StoreHydrator";
import { FirstRunGate } from "@/components/FirstRunGate";

export default function Home() {
  const {
    activeConversationId,
    conversations,
    settings,
    sidebarOpen,
    createConversation,
  } = useAppStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = conversation?.messages ?? [];
  const isStreaming = messages.some((m) => m.isStreaming);
  const isChat = messages.length > 0;

  const { sendMessage, stop } = useChat(activeConversationId);

  // Pending message queued while waiting for a new conversation to be created
  const pendingMessage = useRef<string | null>(null);
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (pendingMessage.current && activeConversationId) {
      const msg = pendingMessage.current;
      pendingMessage.current = null;
      // Defer one tick so the hook picks up the new conversationId
      setTimeout(() => sendMessageRef.current(msg), 0);
    }
  }, [activeConversationId]);

  const handleSend = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !settings.defaultModel) return;

      if (!activeConversationId) {
        pendingMessage.current = trimmed;
        createConversation(settings.defaultModel);
      } else {
        sendMessage(trimmed);
      }
    },
    [activeConversationId, settings.defaultModel, createConversation, sendMessage]
  );

  // Auto-scroll to bottom when new messages arrive or streaming updates
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming]);

  return (
    <>
      <StoreHydrator />
      <FirstRunGate />
      <BackgroundEffects />

      <div className="flex h-screen overflow-hidden">
        {/* Glass sidebar — slides in when in chat mode */}
        <AnimatePresence>
          {isChat && sidebarOpen && <ChatSidebar key="sidebar" />}
        </AnimatePresence>

        {/* Main column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar isChat={isChat} />

          {/* Content area: landing hero ↔ message thread */}
          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {!isChat ? (
                /* ── Landing ──────────────────────────────────────── */
                <motion.div
                  key="landing"
                  className="absolute inset-0 flex flex-col"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.18 } }}
                >
                  <LandingHero onSend={handleSend} />
                </motion.div>
              ) : (
                /* ── Chat messages ─────────────────────────────────── */
                <motion.div
                  key="chat"
                  className="absolute inset-0 overflow-y-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.25 } }}
                  exit={{ opacity: 0 }}
                >
                  <div className="max-w-3xl mx-auto py-6 pb-2">
                    {messages.map((msg, i) => (
                      <MessageBubble key={msg.id} message={msg} index={i} />
                    ))}
                    <div ref={bottomRef} className="h-4" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input — always pinned at bottom */}
          <div
            className="flex-shrink-0 px-4 pb-5 pt-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div className="max-w-3xl mx-auto">
              <InputComposer
                onSend={handleSend}
                onStop={stop}
                isStreaming={isStreaming}
                disabled={!settings.defaultModel}
              />
              <p className="text-center text-[11px] text-zinc-700 mt-2">
                Redstone may make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal />
    </>
  );
}
