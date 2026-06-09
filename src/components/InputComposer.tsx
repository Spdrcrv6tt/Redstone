"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type DragEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ArrowUp,
  Square,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useModels } from "@/hooks/useModels";
import { ModelPicker } from "@/components/ModelPicker";
import { processFiles, formatFileSize, MAX_FILES } from "@/lib/files";
import type { MessageAttachment } from "@/types";

interface InputComposerProps {
  onSend: (message: string, attachments: MessageAttachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function InputComposer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = "Ask anything",
  autoFocus,
}: InputComposerProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    settings,
    updateSettings,
    activeConversationId,
    conversations,
    updateConversationModel,
  } = useAppStore();
  const { loading, error } = useModels();

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const currentModel = activeConv?.model || settings.defaultModel;

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setFileError(null);
      const list = Array.from(files);
      if (attachments.length + list.length > MAX_FILES) {
        setFileError(`Maximum ${MAX_FILES} files per message`);
        return;
      }
      try {
        const processed = await processFiles(list);
        setAttachments((prev) => [...prev, ...processed]);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : String(err));
      }
    },
    [attachments.length]
  );

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    const hasContent = trimmed.length > 0 || attachments.length > 0;
    if (!hasContent || isStreaming || disabled) return;
    onSend(trimmed, attachments);
    setInput("");
    setAttachments([]);
    setFileError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, attachments, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleModelChange = (name: string) => {
    updateSettings({ defaultModel: name });
    if (activeConversationId && activeConv) {
      updateConversationModel(activeConversationId, name);
    }
  };

  const awaitingModel = !currentModel && !loading;
  const blocked = disabled || awaitingModel;
  const canSend =
    (input.trim().length > 0 || attachments.length > 0) &&
    !blocked &&
    !isStreaming;

  const placeholderText = loading
    ? "Loading models…"
    : error
      ? "Connection issue — check Settings"
      : awaitingModel
        ? "Select a model to begin"
        : placeholder;

  return (
    <div className="w-full">
      <motion.div
        layout
        className="w-full"
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div
          className={[
            "relative rounded-[28px] composer-surface transition-all duration-300",
            dragOver ? "ring-2 ring-indigo-300/60" : "",
            blocked && !loading ? "opacity-60" : "",
          ].join(" ")}
        >
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                className="flex flex-wrap gap-2 px-4 pt-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative group flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl bg-surface-muted border border-theme"
                  >
                    {att.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.previewUrl}
                        alt={att.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                        <FileText className="w-4 h-4 text-secondary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-primary truncate max-w-[120px]">
                        {att.name}
                      </p>
                      <p className="text-[10px] text-muted">
                        {formatFileSize(att.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="ml-1 p-0.5 rounded-full text-muted hover:text-primary hover:bg-surface-hover transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {fileError && (
            <p className="px-5 pt-3 text-xs text-red-500">{fileError}</p>
          )}

          <div className="flex items-end gap-1.5 px-3 py-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || attachments.length >= MAX_FILES}
              title="Attach files"
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-muted transition-all duration-200 active:scale-95 disabled:opacity-40"
            >
              <Plus className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.txt,.md,.json,.csv,.xml,.html,.js,.ts,.tsx,.jsx,.py,.go,.rs,.java,.css,.yaml,.yml,.sql,.sh"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); resize(); }}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              disabled={blocked || isStreaming}
              rows={1}
              className="flex-1 bg-transparent text-[length:var(--chat-text)] text-primary placeholder:text-muted resize-none outline-none leading-relaxed min-h-[44px] max-h-[180px] py-3"
            />

            <ModelPicker
              value={currentModel}
              onChange={handleModelChange}
              variant="compact"
            />

            {isStreaming ? (
              <button
                onClick={onStop}
                title="Stop"
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center btn-send active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                title="Send"
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center btn-send active:scale-95"
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {dragOver && (
              <motion.div
                className="absolute inset-0 rounded-[28px] bg-indigo-500/10 border-2 border-dashed border-indigo-400/50 flex items-center justify-center pointer-events-none z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-2 text-sm text-indigo-500">
                  <ImageIcon className="w-4 h-4" />
                  Drop files here
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <p className="text-center text-[11px] text-muted/80 mt-3 px-4 tracking-wide">
        Redstone can make mistakes — verify important information.
      </p>
    </div>
  );
}
