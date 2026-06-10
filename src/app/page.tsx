"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useChat } from "@/hooks/useChat";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { AmbientBackground } from "@/components/AmbientBackground";
import { ChatSidebar } from "@/components/ChatSidebar";
import { MobileTopBar } from "@/components/MobileTopBar";
import { LandingGreeting } from "@/components/LandingGreeting";
import { MessageBubble } from "@/components/MessageBubble";
import { InputComposer } from "@/components/InputComposer";
import { SettingsModal } from "@/components/SettingsModal";
import { AppBootstrap } from "@/components/AppBootstrap";
import { EngineModeToggle } from "@/components/EngineModeToggle";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";
import type { MessageAttachment } from "@/types";

const COMPOSER_SPRING = { type: "spring" as const, stiffness: 380, damping: 38 };

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState("");
  const [composerHasAttachments, setComposerHasAttachments] = useState(false);
  const isMobile = useIsMobile();

  const {
    activeConversationId,
    conversations,
    settings,
    createConversation,
    setActiveConversation,
    setSidebarExpanded,
    engineMode,
  } = useAppStore();

  const isCanvasMode = engineMode === "canvas";

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = conversation?.messages ?? [];
  const isStreaming = messages.some((m) => m.isStreaming);
  const isChat = messages.length > 0;
  const showAurora = !isChat && !isCanvasMode;
  const showSplash =
    !isChat && !composerDraft.trim() && !composerHasAttachments;

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

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

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

  const ensureWorkspaceConversation = useCallback(() => {
    if (activeConversationId) return activeConversationId;
    if (!settings.defaultModel) return "";
    return createConversation(settings.defaultModel);
  }, [activeConversationId, createConversation, settings.defaultModel]);

  useEffect(() => {
    if (isCanvasMode && !activeConversationId && settings.defaultModel) {
      createConversation(settings.defaultModel);
    }
  }, [isCanvasMode, activeConversationId, settings.defaultModel, createConversation]);

  const handleNewChat = useCallback(() => {
    setActiveConversation(null);
    setSidebarExpanded(false);
    setMobileNavOpen(false);
    setComposerDraft("");
    setComposerHasAttachments(false);
  }, [setActiveConversation, setSidebarExpanded]);

  const handleDraftChange = useCallback(
    (draft: string, hasAttachments: boolean) => {
      setComposerDraft(draft);
      setComposerHasAttachments(hasAttachments);
    },
    []
  );

  const composerKey = activeConversationId ?? "landing";

  return (
    <>
      <AppBootstrap />

      <LayoutGroup id="chat-shell">
        <div className="app-shell flex h-dvh overflow-hidden">
          <ChatSidebar
            onNewChat={handleNewChat}
            mobileOpen={mobileNavOpen}
            onMobileClose={() => setMobileNavOpen(false)}
          />

          <main
            className={[
              "app-main flex flex-col flex-1 min-w-0 relative isolate overflow-hidden",
              isChat ? "app-main--chat" : "",
            ].join(" ")}
          >
            <AnimatePresence>
              {showAurora ? <AmbientBackground key="aurora" /> : null}
            </AnimatePresence>

            <div className="app-main-stack relative z-10 flex flex-col flex-1 min-h-0 min-w-0">
              <MobileTopBar
                onOpenMenu={() => setMobileNavOpen(true)}
                onNewChat={handleNewChat}
              />

              {isCanvasMode ? (
                activeConversationId ? (
                  <WorkspaceView
                    conversationId={activeConversationId}
                    onEnsureConversation={ensureWorkspaceConversation}
                    isMobile={isMobile}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted">
                    Opening workspace…
                  </div>
                )
              ) : (
              <div
                className={[
                  "flex-1 flex flex-col min-h-0",
                  !isChat ? "landing-shell" : "",
                ].join(" ")}
              >
                <div className="hidden md:flex justify-center pt-3 px-4 flex-shrink-0">
                  <EngineModeToggle />
                </div>

                {isChat ? (
                  <>
                    <motion.div
                      className="chat-scroll flex-1 overflow-y-auto min-h-0 overscroll-contain"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="chat-thread-wrap mx-auto w-full px-3 sm:px-6 pt-4 md:pt-10 pb-4">
                        {messages.map((msg) => (
                          <MessageBubble
                            key={msg.id}
                            message={msg}
                            conversationId={activeConversationId ?? undefined}
                            onRegenerate={regenerate}
                            showRegenerate={
                              msg.id === lastAssistantId && !isStreaming
                            }
                          />
                        ))}
                      </div>
                    </motion.div>

                    <motion.div
                      layout
                      layoutId="chat-composer"
                      transition={COMPOSER_SPRING}
                      className="chat-composer-wrap w-full flex-shrink-0 mx-auto composer-in-chat"
                    >
                      <InputComposer
                        key={composerKey}
                        onSend={handleSend}
                        onStop={stop}
                        isStreaming={isStreaming}
                        autoFocus={!isMobile}
                        placeholder={isMobile ? "Ask" : "Ask anything"}
                        onDraftChange={handleDraftChange}
                      />
                    </motion.div>
                  </>
                ) : (
                  <>
                    <div className="landing-splash-slot">
                      <AnimatePresence mode="wait">
                        {showSplash ? <LandingGreeting key="splash" /> : null}
                      </AnimatePresence>
                    </div>

                    <motion.div
                      layoutId="chat-composer"
                      className="chat-composer-wrap w-full flex-shrink-0 mx-auto composer-in-chat"
                    >
                      <InputComposer
                        key={composerKey}
                        onSend={handleSend}
                        onStop={stop}
                        isStreaming={isStreaming}
                        autoFocus={!isMobile}
                        placeholder={isMobile ? "Ask" : "Ask anything"}
                        onDraftChange={handleDraftChange}
                      />
                    </motion.div>

                    <div className="landing-balance-slot" aria-hidden />
                  </>
                )}
              </div>
              )}
            </div>
          </main>
        </div>
      </LayoutGroup>

      <SettingsModal />
    </>
  );
}
