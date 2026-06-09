"use client";

import { useRef, useEffect, useCallback } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useChat } from "@/hooks/useChat";
import { AmbientBackground } from "@/components/AmbientBackground";
import { ChatSidebar } from "@/components/ChatSidebar";
import { LandingGreeting } from "@/components/LandingGreeting";
import { MessageBubble } from "@/components/MessageBubble";
import { InputComposer } from "@/components/InputComposer";
import { SettingsModal } from "@/components/SettingsModal";
import { AppBootstrap } from "@/components/AppBootstrap";
import type { MessageAttachment } from "@/types";

export default function Home() {
  const {
    activeConversationId,
    conversations,
    settings,
    createConversation,
    setActiveConversation,
    setSidebarExpanded,
  } = useAppStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = conversation?.messages ?? [];
  const isStreaming = messages.some((m) => m.isStreaming);
  const isChat = messages.length > 0;

  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  })();

  const { sendMessage, stop, regenerate } = useChat(activeConversationId);

  const pending = useRef<{
    content: string;
    attachments: MessageAttachment[];
  } | null>(null);
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  useEffect(() => {
    if (pending.current && activeConversationId) {
      const { content, attachments } = pending.current;
      pending.current = null;
      setTimeout(() => sendRef.current(content, attachments), 0);
    }
  }, [activeConversationId]);

  const handleSend = useCallback(
    (content: string, attachments: MessageAttachment[] = []) => {
      if (!settings.defaultModel) return;
      const hasContent = content.trim().length > 0 || attachments.length > 0;
      if (!hasContent) return;

      if (!activeConversationId) {
        pending.current = { content, attachments };
        createConversation(settings.defaultModel);
      } else {
        sendMessage(content, attachments);
      }
    },
    [activeConversationId, settings.defaultModel, createConversation, sendMessage]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversation(null);
    setSidebarExpanded(false);
  }, [setActiveConversation, setSidebarExpanded]);

  const composerKey = activeConversationId ?? "landing";

  return (
    <>
      <AppBootstrap />
      <AmbientBackground />

      <LayoutGroup>
        <div className="flex h-screen overflow-hidden">
          <ChatSidebar onNewChat={handleNewChat} />

          <main className="flex flex-col flex-1 min-w-0 relative">
            <div
              className={[
                "flex-1 flex flex-col min-h-0",
                !isChat ? "justify-center items-center" : "",
              ].join(" ")}
            >
              <AnimatePresence mode="wait">
                {!isChat ? (
                  <LandingGreeting key="greeting" />
                ) : (
                  <motion.div
                    key="thread"
                    className="chat-scroll flex-1 overflow-y-auto min-h-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="chat-thread-wrap mx-auto w-full px-4 sm:px-6 pt-10 pb-4">
                      {messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          onRegenerate={regenerate}
                          showRegenerate={
                            msg.id === lastAssistantId && !isStreaming
                          }
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                layout
                className={[
                  "chat-composer-wrap w-full px-4 flex-shrink-0 mx-auto",
                  isChat ? "pb-4 pt-2" : "mt-8 pb-[10vh]",
                ].join(" ")}
                transition={{ type: "spring", stiffness: 400, damping: 38 }}
              >
                <InputComposer
                  key={composerKey}
                  onSend={handleSend}
                  onStop={stop}
                  isStreaming={isStreaming}
                  autoFocus
                />
              </motion.div>
            </div>
          </main>
        </div>
      </LayoutGroup>

      <SettingsModal />
    </>
  );
}
