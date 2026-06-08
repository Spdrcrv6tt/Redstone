"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface InputBarProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function InputBar({ onSend, onStop, isStreaming, disabled }: InputBarProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { settings } = useAppStore();

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const canSend = input.trim().length > 0 && !disabled && !isStreaming;

  return (
    <div className="px-4 pb-4 pt-2">
      <div className={`flex items-end gap-2 bg-zinc-800/80 border rounded-2xl px-4 py-3 transition-colors ${
        disabled ? "border-zinc-700/50 opacity-60" : "border-zinc-700 focus-within:border-zinc-600"
      }`}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Select a model to start chatting…"
              : "Message… (Enter to send, Shift+Enter for newline)"
          }
          disabled={disabled || isStreaming}
          rows={1}
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 resize-none outline-none leading-relaxed max-h-48 overflow-y-auto disabled:cursor-not-allowed"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-600 hover:bg-zinc-500 text-zinc-200 transition-colors"
            title="Stop generating"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-400 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-orange-500"
            title="Send message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <p className="text-center text-xs text-zinc-600 mt-2">
        {settings.defaultModel
          ? `Talking to ${settings.defaultModel} · locally via Ollama`
          : "No model selected"}
      </p>
    </div>
  );
}
