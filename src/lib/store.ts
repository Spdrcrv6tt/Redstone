"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, Message, AppSettings, OllamaModel } from "@/types";
import type { Theme } from "@/types";
import { generateId } from "@/lib/utils";
import { generateTitle } from "@/lib/ollama";

interface AppState {
  // conversations
  conversations: Conversation[];
  activeConversationId: string | null;

  // models
  models: OllamaModel[];
  modelsLoading: boolean;
  modelsError: string | null;

  // settings
  settings: AppSettings;

  // ui
  theme: Theme;
  sidebarExpanded: boolean;
  settingsOpen: boolean;

  // actions
  createConversation: (model?: string) => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  updateConversationTitle: (id: string, title: string) => void;

  addMessage: (conversationId: string, message: Omit<Message, "id">) => string;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;

  setModels: (models: OllamaModel[]) => void;
  setModelsLoading: (loading: boolean) => void;
  setModelsError: (error: string | null) => void;

  updateConversationModel: (conversationId: string, model: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setSettingsOpen: (open: boolean) => void;

}

export const PREFERRED_DEFAULT_MODEL = "gemma4:12b";

const DEFAULT_SETTINGS: AppSettings = {
  ollamaHost: "https://ollama.deoxylabs.com",
  apiKey: "",
  braveApiKey: "",
  defaultModel: PREFERRED_DEFAULT_MODEL,
  routerModel: "",
  searchMode: "auto",
  debugMode: false,
  streamResponses: true,
  systemPrompt: "",
  temperature: 0.7,
  displayName: "",
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      models: [],
      modelsLoading: false,
      modelsError: null,
      settings: DEFAULT_SETTINGS,
      theme: "light",
      sidebarExpanded: false,
      settingsOpen: false,

      createConversation: (model) => {
        const { settings } = get();
        const id = generateId();
        const conversation: Conversation = {
          id,
          title: "New Chat",
          messages: [],
          model: model || settings.defaultModel || "",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({
          conversations: [conversation, ...s.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      deleteConversation: (id) => {
        set((s) => {
          const filtered = s.conversations.filter((c) => c.id !== id);
          const nextActive =
            s.activeConversationId === id
              ? (filtered[0]?.id ?? null)
              : s.activeConversationId;
          return { conversations: filtered, activeConversationId: nextActive };
        });
      },

      setActiveConversation: (id) => set({ activeConversationId: id }),

      updateConversationTitle: (id, title) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }));
      },

      addMessage: (conversationId, message) => {
        const id = generateId();
        const fullMessage: Message = { ...message, id };
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const msgs = [...c.messages, fullMessage];
            // Auto-title from first user message
            const title =
              c.messages.length === 0 && message.role === "user"
                ? generateTitle(message.content)
                : c.title;
            return { ...c, messages: msgs, title, updatedAt: Date.now() };
          }),
        }));
        return id;
      },

      updateMessage: (conversationId, messageId, patch) => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, ...patch } : m
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      deleteMessage: (conversationId, messageId) => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              messages: c.messages.filter((m) => m.id !== messageId),
            };
          }),
        }));
      },

      updateConversationModel: (conversationId, model) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, model } : c
          ),
        }));
      },

      setModels: (models) => set({ models }),
      setModelsLoading: (loading) => set({ modelsLoading: loading }),
      setModelsError: (error) => set({ modelsError: error }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),

      toggleSidebar: () =>
        set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
      setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
    }),
    {
      name: "redstone-app",
      // Prevents SSR/client hydration mismatches — rehydration is triggered
      // manually from AppBootstrap after the first client paint.
      skipHydration: true,
      partialize: (s) => ({
        conversations: s.conversations,
        activeConversationId: s.activeConversationId,
        settings: s.settings,
        theme: s.theme,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<AppState> | undefined;
        if (!saved) return current;
        return {
          ...current,
          ...saved,
          theme: saved.theme ?? current.theme,
          settings: {
            ...DEFAULT_SETTINGS,
            ...saved.settings,
            defaultModel:
              saved.settings?.defaultModel || DEFAULT_SETTINGS.defaultModel,
            searchMode:
              saved.settings?.searchMode || DEFAULT_SETTINGS.searchMode,
            debugMode:
              saved.settings?.debugMode ?? DEFAULT_SETTINGS.debugMode,
          },
        };
      },
    }
  )
);
