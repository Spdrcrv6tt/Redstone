"use client";

import { motion } from "framer-motion";
import { Plus, Trash2, MessageSquare, Settings, PanelLeftClose, Flame } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAppStore } from "@/lib/store";

export function ChatSidebar() {
  const {
    conversations,
    activeConversationId,
    settings,
    createConversation,
    deleteConversation,
    setActiveConversation,
    setSidebarOpen,
    setSettingsOpen,
  } = useAppStore();

  const handleNew = () => {
    if (settings.defaultModel) createConversation(settings.defaultModel);
  };

  return (
    <motion.aside
      className="flex-shrink-0 w-64 h-full flex flex-col overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
      initial={{ x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -16, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <span className="text-sm font-semibold text-zinc-200 tracking-tight">Redstone</span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 transition-colors"
          style={{ background: "rgba(255,255,255,0)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0)")}
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New chat */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={handleNew}
          disabled={!settings.defaultModel}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed group"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
          onMouseEnter={(e) => {
            if (settings.defaultModel) {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-center text-xs text-zinc-700 py-8">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => setActiveConversation(conv.id)}
            className="group relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
            style={{
              background: conv.id === activeConversationId
                ? "rgba(255,255,255,0.07)"
                : "transparent",
              border: conv.id === activeConversationId
                ? "1px solid rgba(255,255,255,0.09)"
                : "1px solid transparent",
            }}
            onMouseEnter={(e) => {
              if (conv.id !== activeConversationId) {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              }
            }}
            onMouseLeave={(e) => {
              if (conv.id !== activeConversationId) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }
            }}
          >
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-zinc-600" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate leading-snug ${conv.id === activeConversationId ? "text-zinc-200" : "text-zinc-500"}`}>
                {conv.title}
              </p>
              <p className="text-xs text-zinc-700 mt-0.5">
                {formatDistanceToNow(conv.updatedAt, { addSuffix: true })}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-600 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-zinc-600 hover:text-zinc-300 transition-all duration-150"
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>
    </motion.aside>
  );
}
