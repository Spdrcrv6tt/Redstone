"use client";

import { useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { remoteUrlFromProxy } from "@/lib/image-proxy";
import { streamAgent } from "@/lib/ollama";
import { buildMessageContent, extractImages } from "@/lib/files";
import type {
  Message,
  MessageAttachment,
  MessageSearchMeta,
  OllamaChatMessage,
  AppSettings,
} from "@/types";

function collectPriorImageUrls(messages: Message[]): string[] {
  const urls = new Set<string>();
  for (const m of messages) {
    for (const img of m.search?.images ?? []) {
      for (const proxy of [img.imageUrl, img.thumbnailUrl]) {
        const remote = remoteUrlFromProxy(proxy);
        urls.add(remote ?? proxy);
      }
      if (img.sourceUrl) urls.add(img.sourceUrl);
    }
  }
  return [...urls];
}

function toApiMessage(m: Message): OllamaChatMessage {
  const content = buildMessageContent(m.content, m.attachments ?? []);
  const images = extractImages(m.attachments ?? []);
  return {
    role: m.role,
    content,
    ...(images.length ? { images } : {}),
  };
}

async function streamResponse(
  conversationId: string,
  assistantId: string,
  history: OllamaChatMessage[],
  model: string,
  settings: AppSettings,
  priorImageUrls: string[],
  signal: AbortSignal,
  updateMessage: (
    conversationId: string,
    messageId: string,
    patch: Partial<Message>
  ) => void
) {
  let accumulated = "";
  let searchMeta: MessageSearchMeta | undefined = {
    query: "",
    sources: [],
    images: [],
    videos: [],
    links: [],
    searchError: undefined,
  };

  updateMessage(conversationId, assistantId, {
    search: { query: "", sources: [], images: [], videos: [], links: [] },
    agentStatus: { redstone_status: "routing", message: "Thinking…" },
  });

  const generator = streamAgent(
    settings.ollamaHost,
    {
      model,
      messages: history,
      stream: true,
      options: {
        temperature: settings.temperature,
        num_ctx: settings.numCtx,
        num_predict: 4096,
      },
    },
    signal,
    settings.apiKey,
    settings.braveApiKey,
    settings.systemPrompt,
    priorImageUrls,
    settings.searchMode,
    settings.debugMode
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
      updateMessage(conversationId, assistantId, {
        content: accumulated,
        isStreaming: !chunk.done,
        search: searchMeta,
        agentStatus: undefined,
      });
    }
    if (chunk.done) {
      updateMessage(conversationId, assistantId, {
        content: accumulated,
        isStreaming: false,
        search: searchMeta,
        agentStatus: undefined,
      });
      break;
    }
  }
}

export function useChat(conversationId: string | null) {
  const abortRef = useRef<AbortController | null>(null);
  const {
    conversations,
    settings,
    addMessage,
    updateMessage,
    deleteMessage,
  } = useAppStore();

  const conversation = conversations.find((c) => c.id === conversationId);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runStream = useCallback(
    async (
      history: OllamaChatMessage[],
      model: string,
      priorImageUrls: string[] = []
    ) => {
      if (!conversationId) return;

      const assistantId = addMessage(conversationId, {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        model,
        isStreaming: true,
      });

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        await streamResponse(
          conversationId,
          assistantId,
          history,
          model,
          settings,
          priorImageUrls,
          abortRef.current.signal,
          updateMessage
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
    [conversationId, settings, addMessage, updateMessage]
  );

  const sendMessage = useCallback(
    async (content: string, attachments: MessageAttachment[] = []) => {
      if (!conversationId || !conversation) return;
      if (!conversation.model) return;

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

      const priorImageUrls = collectPriorImageUrls(conversation.messages);
      await runStream(history, conversation.model, priorImageUrls);
    },
    [conversationId, conversation, addMessage, runStream]
  );

  const regenerate = useCallback(async () => {
    if (!conversationId || !conversation?.model) return;

    const msgs = conversation.messages;
    let lastAssistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;

    const prior = msgs.slice(0, lastAssistantIdx);
    deleteMessage(conversationId, msgs[lastAssistantIdx].id);

    const history: OllamaChatMessage[] = prior.map(toApiMessage);
    const priorImageUrls = collectPriorImageUrls(prior);

    await runStream(history, conversation.model, priorImageUrls);
  }, [
    conversationId,
    conversation,
    deleteMessage,
    runStream,
  ]);

  return { sendMessage, stop, regenerate, conversation };
}
