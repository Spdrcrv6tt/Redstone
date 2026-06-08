"use client";

import { useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { streamChat } from "@/lib/ollama";
import { generateId } from "@/lib/utils";
import type { Message } from "@/types";

export function useChat(conversationId: string | null) {
  const abortRef = useRef<AbortController | null>(null);
  const {
    conversations,
    settings,
    addMessage,
    updateMessage,
    updateConversationTitle,
  } = useAppStore();

  const conversation = conversations.find((c) => c.id === conversationId);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !conversation) return;
      if (!conversation.model) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      // Add user message
      addMessage(conversationId, {
        role: "user",
        content,
        timestamp: Date.now(),
      });

      // Prepare assistant placeholder
      const assistantId = generateId();
      const assistantPlaceholder: Omit<Message, "id"> = {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        model: conversation.model,
        isStreaming: true,
      };
      addMessage(conversationId, assistantPlaceholder);

      // Build messages list for the API
      const history = [
        ...(settings.systemPrompt
          ? [{ role: "system" as const, content: settings.systemPrompt }]
          : []),
        ...conversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content },
      ];

      try {
        let accumulated = "";

        const generator = streamChat(
          settings.ollamaHost,
          {
            model: conversation.model,
            messages: history,
            stream: true,
            options: { temperature: settings.temperature },
          },
          abortRef.current.signal,
          settings.apiKey
        );

        for await (const chunk of generator) {
          if (chunk.message?.content) {
            accumulated += chunk.message.content;
            updateMessage(conversationId, assistantId, {
              content: accumulated,
              isStreaming: !chunk.done,
            });
          }
          if (chunk.done) {
            updateMessage(conversationId, assistantId, {
              content: accumulated,
              isStreaming: false,
            });
            break;
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          updateMessage(conversationId, assistantId, { isStreaming: false });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          updateMessage(conversationId, assistantId, {
            isStreaming: false,
            error: msg,
          });
        }
      }
    },
    [conversationId, conversation, settings, addMessage, updateMessage, updateConversationTitle]
  );

  return { sendMessage, stop, conversation };
}
