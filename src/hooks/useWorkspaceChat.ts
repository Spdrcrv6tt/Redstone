"use client";

import { useRef, useCallback } from "react";
import {
  parseCanvasPatchesFromText,
  parseStreamingCanvasPatches,
  stripCanvasBlocks,
} from "@/lib/canvas/protocol";
import { buildMessageContent, extractImages } from "@/lib/files";
import { streamAgent } from "@/lib/ollama";
import { useAppStore } from "@/lib/store";
import type {
  Message,
  MessageAttachment,
  MessageSearchMeta,
  OllamaChatMessage,
  AppSettings,
} from "@/types";
import type { CanvasPatch, CanvasViewportContext } from "@/types/canvas";

function toApiMessage(m: Message): OllamaChatMessage {
  const content = buildMessageContent(m.content, m.attachments ?? []);
  const images = extractImages(m.attachments ?? []);
  return {
    role: m.role,
    content,
    ...(images.length ? { images } : {}),
  };
}

async function streamWorkspaceResponse(
  conversationId: string,
  assistantId: string,
  history: OllamaChatMessage[],
  model: string,
  settings: AppSettings,
  spatial: CanvasViewportContext,
  signal: AbortSignal,
  updateMessage: (
    conversationId: string,
    messageId: string,
    patch: Partial<Message>
  ) => void,
  applyCanvasPatches: (conversationId: string, patches: CanvasPatch[]) => void
) {
  let accumulated = "";
  let appliedPatchCount = 0;
  let searchMeta: MessageSearchMeta | undefined = {
    query: "",
    sources: [],
    images: [],
    videos: [],
    links: [],
  };

  updateMessage(conversationId, assistantId, {
    search: { query: "", sources: [], images: [], videos: [], links: [] },
    agentStatus: { redstone_status: "routing", message: "Updating canvas…" },
  });

  const generator = streamAgent(
    settings.ollamaHost,
    {
      model,
      messages: history,
      stream: true,
      options: {
        temperature: settings.temperature,
        num_ctx: 16384,
        num_predict: 4096,
      },
    },
    signal,
    settings.apiKey,
    settings.braveApiKey,
    settings.systemPrompt,
    [],
    settings.searchMode,
    settings.debugMode,
    spatial,
    "canvas"
  );

  for await (const event of generator) {
    if (event.type === "status") {
      updateMessage(conversationId, assistantId, {
        agentStatus: event.status,
      });
      continue;
    }

    if (event.type === "meta") {
      searchMeta = event.meta;
      updateMessage(conversationId, assistantId, {
        search: event.meta,
        agentStatus: undefined,
      });
      continue;
    }

    const chunk = event.chunk;
    if (chunk.message?.content) {
      accumulated += chunk.message.content;

      const streamingPatches = parseStreamingCanvasPatches(accumulated);
      if (streamingPatches.length > appliedPatchCount) {
        applyCanvasPatches(
          conversationId,
          streamingPatches.slice(appliedPatchCount)
        );
        appliedPatchCount = streamingPatches.length;
      }

      updateMessage(conversationId, assistantId, {
        content: stripCanvasBlocks(accumulated),
        isStreaming: !chunk.done,
        search: searchMeta,
        agentStatus: undefined,
      });
    }
    if (chunk.done) {
      const patches = parseCanvasPatchesFromText(accumulated);
      if (patches.length > appliedPatchCount) {
        applyCanvasPatches(
          conversationId,
          patches.slice(appliedPatchCount)
        );
      }
      updateMessage(conversationId, assistantId, {
        content: stripCanvasBlocks(accumulated),
        isStreaming: false,
        search: searchMeta,
        agentStatus: undefined,
      });
      break;
    }
  }
}

export function useWorkspaceChat(conversationId: string | null) {
  const abortRef = useRef<AbortController | null>(null);
  const {
    conversations,
    settings,
    addMessage,
    updateMessage,
    applyCanvasPatches,
  } = useAppStore();

  const conversation = conversations.find((c) => c.id === conversationId);
  const isStreaming = conversation?.messages.some((m) => m.isStreaming) ?? false;
  const isThinking =
    conversation?.messages.some(
      (m) => m.isStreaming || !!m.agentStatus
    ) ?? false;

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (
      content: string,
      attachments: MessageAttachment[] = [],
      spatial: CanvasViewportContext
    ) => {
      if (!conversationId || !conversation?.model) return;
      const hasContent =
        content.trim().length > 0 || attachments.length > 0;
      if (!hasContent) return;

      addMessage(conversationId, {
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
        attachments: attachments.length ? attachments : undefined,
      });

      const userApiMessage: OllamaChatMessage = {
        role: "user",
        content: buildMessageContent(content.trim(), attachments),
        ...(extractImages(attachments).length
          ? { images: extractImages(attachments) }
          : {}),
      };

      const history: OllamaChatMessage[] = [
        ...conversation.messages.map(toApiMessage),
        userApiMessage,
      ];

      const assistantId = addMessage(conversationId, {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        model: conversation.model,
        isStreaming: true,
      });

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        await streamWorkspaceResponse(
          conversationId,
          assistantId,
          history,
          conversation.model,
          settings,
          spatial,
          abortRef.current.signal,
          updateMessage,
          applyCanvasPatches
        );
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
    [
      conversationId,
      conversation,
      settings,
      addMessage,
      updateMessage,
      applyCanvasPatches,
    ]
  );

  return { sendMessage, stop, isStreaming, isThinking, conversation };
}
