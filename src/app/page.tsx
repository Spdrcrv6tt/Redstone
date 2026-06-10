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
import { WorkspaceView } from "@/components/workspace/WorkspaceView";
import type { MessageAttachment } from "@/types";

const COMPOSER_SPRING = { type: "spring" as const, stiffness: 380, damping: 38 };

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState("");
  const [composerHasAttachments, setComposerHasAttachments] = useState(false);
  const [canvasPending, setCanvasPending] = useState(false);
  const [pendingCanvasMessage, setPendingCanvasMessage] = useState<{
    content: string;
    attachments: MessageAttachment[];
  } | null>(null);
  const isMobile = useIsMobile();

  const {
    activeConversationId,
    conversations,
    settings,
    createConversation,
    setActiveConversation,
    setSidebarExpanded,
    promoteConversationToCanvas,
  } = useAppStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const isCanvasConversation = conversation?.engineMode === "canvas";
  const messages = conversation?.messages ?? [];
  const isStreaming = messages.some((m) => m.isStreaming);
  const isChat = messages.length > 0;
  const showAurora = !isChat && !isCanvasConversation;
  const showSplash =
    !isChat && !composerDraft.trim() && !composerHasAttachments;

  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  })();

  const { sendMessage, stop, regenerate } = useChat(
    isCanvasConversation ? null : activeConversationId
  );

  const pending = useRef<{
    content: string;
    attachments: MessageAttachment[];
  } | null>(null);
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  useEffect(() => {
    if (pending.current && activeConversationId && !isCanvasConversation) {
      const { content, attachments } = pending.current;
      pending.current = null;
      setTimeout(() => sendRef.current(content, attachments), 0);
    }
  }, [activeConversationId, isCanvasConversation]);

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    setCanvasPending(false);
  }, [activeConversationId]);

  const handleSend = useCallback(
    (content: string, attachments: MessageAttachment[] = []) => {
      if (!settings.defaultModel) return;
      const hasContent = content.trim().length > 0 || attachments.length > 0;
      if (!hasContent) return;

      if (canvasPending && !isCanvasConversation) {
        let convId = activeConversationId;
        if (!convId) {
          convId = createConversation(settings.defaultModel);
        }
        promoteConversationToCanvas(convId);
        setCanvasPending(false);
        setPendingCanvasMessage({ content, attachments });
        return;
      }

      if (!activeConversationId) {
        pending.current = { content, attachments };
        createConversation(settings.defaultModel);
      } else {
        sendMessage(content, attachments);
      }
    },
    [
      activeConversationId,
      canvasPending,
      createConversation,
      isCanvasConversation,
      promoteConversationToCanvas,
      sendMessage,
      settings.defaultModel,
    ]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversation(null);
    setSidebarExpanded(false);
    setMobileNavOpen(false);
    setComposerDraft("");
    setComposerHasAttachments(false);
    setCanvasPending(false);
    setPendingCanvasMessage(null);
  }, [setActiveConversation, setSidebarExpanded]);

  const handleDraftChange = useCallback(
    (draft: string, hasAttachments: boolean) => {
      setComposerDraft(draft);
      setComposerHasAttachments(hasAttachments);
    },
    []
  );

  const composerKey = activeConversationId ?? "landing";
  const showCanvasMenuOption = !isCanvasConversation;

  const chatComposer = (
    <InputComposer
      key={composerKey}
      onSend={handleSend}
      onStop={stop}
      isStreaming={isStreaming}
      autoFocus={!isMobile}
      placeholder={
        canvasPending
          ? isMobile
            ? "Describe your canvas…"
            : "Describe what to build on the canvas…"
          : isMobile
            ? "Ask"
            : "Ask anything"
      }
      onDraftChange={handleDraftChange}
      canvasPending={canvasPending}
      onCanvasPendingChange={setCanvasPending}
      showCanvasMenuOption={showCanvasMenuOption}
    />
  );

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
              isCanvasConversation ? "app-main--canvas" : "",
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

              {isCanvasConversation && activeConversationId ? (
                <WorkspaceView
                  conversationId={activeConversationId}
                  isMobile={isMobile}
                  pendingMessage={pendingCanvasMessage}
                  onPendingMessageSent={() => setPendingCanvasMessage(null)}
                />
              ) : (
                <div
                  className={[
                    "flex-1 flex flex-col min-h-0",
                    !isChat ? "landing-shell" : "",
                  ].join(" ")}
                >
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
                        {chatComposer}
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
                        {chatComposer}
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
