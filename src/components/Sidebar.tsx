"use client";

import { useAppStore } from "@/lib/store";
import { Plus, Trash2, MessageSquare, Settings, ChevronLeft, Flame } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    sidebarOpen,
    createConversation,
    deleteConversation,
    setActiveConversation,
    setSidebarOpen,
    setSettingsOpen,
    settings,
  } = useAppStore();

  const handleNew = () => {
    if (!settings.defaultModel) return;
    createConversation(settings.defaultModel);
  };

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 px-2 border-r border-zinc-800 bg-zinc-900 w-14">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title="Open sidebar"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          onClick={handleNew}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title="New chat"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex flex-col w-64 border-r border-zinc-800 bg-zinc-900 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          <span className="font-semibold text-zinc-100 tracking-tight">Redstone</span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={handleNew}
          disabled={!settings.defaultModel}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {conversations.length === 0 && (
          <div className="text-center py-8 text-zinc-500 text-sm">
            No conversations yet
          </div>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
              conv.id === activeConversationId
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
            onClick={() => setActiveConversation(conv.id)}
          >
            <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{conv.title}</div>
              <div className="text-xs text-zinc-600 mt-0.5">
                {formatDistanceToNow(conv.updatedAt, { addSuffix: true })}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation(conv.id);
              }}
              className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-3">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}
