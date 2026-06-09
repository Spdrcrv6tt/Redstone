"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SquarePen,
  Search,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { RedstoneLogo } from "@/components/RedstoneLogo";

const EXPANDED_W = 280;
const COLLAPSED_W = 56;

interface ChatSidebarProps {
  onNewChat: () => void;
}

export function ChatSidebar({ onNewChat }: ChatSidebarProps) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    conversations,
    activeConversationId,
    sidebarExpanded,
    theme,
    toggleSidebar,
    setSidebarExpanded,
    setActiveConversation,
    deleteConversation,
    setSettingsOpen,
    toggleTheme,
  } = useAppStore();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  useEffect(() => {
    if (sidebarExpanded && query) searchRef.current?.focus();
  }, [sidebarExpanded, query]);

  const selectChat = (id: string) => {
    setActiveConversation(id);
  };

  const iconBtn =
    "w-10 h-10 rounded-full flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover transition-colors";

  return (
    <motion.aside
      className="flex-shrink-0 h-full flex flex-col bg-sidebar border-r border-sidebar overflow-hidden"
      animate={{ width: sidebarExpanded ? EXPANDED_W : COLLAPSED_W }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {sidebarExpanded ? (
          <motion.div
            key="expanded"
            className="flex flex-col h-full min-w-[280px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <RedstoneLogo variant="wordmark" size={24} />
              <button
                onClick={toggleSidebar}
                title="Collapse sidebar"
                className="p-2 rounded-full text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
              >
                <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </button>
            </div>

            {/* New chat */}
            <div className="px-3 py-2">
              <button
                onClick={onNewChat}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full bg-surface hover:bg-surface-muted text-sm font-medium text-primary transition-colors shadow-sm border border-theme/60"
              >
                <SquarePen className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.75} />
                New chat
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search chats"
                  className="w-full pl-10 pr-9 py-2.5 rounded-full bg-surface/60 text-sm text-primary placeholder:text-muted outline-none border border-transparent hover:border-theme focus:border-theme focus:bg-surface transition-all"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted hover:text-primary"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Recents */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-[11px] font-medium text-muted uppercase tracking-wider">
                Recents
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
              {filtered.length === 0 && (
                <div className="text-center py-12 px-4">
                  <p className="text-xs text-muted leading-relaxed">
                    {query ? "No matching chats" : "Your conversations will appear here"}
                  </p>
                </div>
              )}
              {filtered.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectChat(conv.id)}
                  className={[
                    "group flex items-center gap-1 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150",
                    conv.id === activeConversationId
                      ? "sidebar-item-active"
                      : "text-secondary hover:bg-surface-hover hover:text-primary",
                  ].join(" ")}
                >
                  <p className="flex-1 text-sm truncate leading-snug">
                    {conv.title}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted hover:text-red-500 transition-all"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-3 border-t border-sidebar space-y-0.5">
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
              >
                <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
                Settings
              </button>
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
              >
                {theme === "light" ? (
                  <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                ) : (
                  <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} />
                )}
                {theme === "light" ? "Dark mode" : "Light mode"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collapsed"
            className="flex flex-col h-full items-center py-4 gap-1 min-w-[56px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <button
              onClick={toggleSidebar}
              title="Expand sidebar"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-hover transition-colors"
            >
              <RedstoneLogo variant="mark" size={26} />
            </button>

            <button onClick={onNewChat} title="New chat" className={iconBtn}>
              <SquarePen className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>

            <button
              onClick={() => {
                setSidebarExpanded(true);
                setTimeout(() => searchRef.current?.focus(), 150);
              }}
              title="Search chats"
              className={iconBtn}
            >
              <Search className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>

            <div className="flex-1" />

            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className={iconBtn}
            >
              <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>

            <button
              onClick={toggleTheme}
              title={theme === "light" ? "Dark mode" : "Light mode"}
              className={iconBtn}
            >
              {theme === "light" ? (
                <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              ) : (
                <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} />
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
