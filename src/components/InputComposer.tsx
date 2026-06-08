"use client";

import {
  useState,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { ArrowUp, Square } from "lucide-react";

interface InputComposerProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function InputComposer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = "Message Redstone…",
}: InputComposerProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    resize();
  };

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0 && !disabled && !isStreaming;

  return (
    <div
      className={[
        "relative rounded-2xl transition-all duration-300 input-shine",
        "bg-white/[0.04] backdrop-blur-2xl",
        focused
          ? "border border-orange-500/25 shadow-[0_0_0_1px_rgba(249,115,22,0.1),0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <div className="flex items-end gap-3 px-5 py-4">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={disabled ? "Select a model in settings first…" : placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          className="flex-1 bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-600 resize-none outline-none leading-relaxed disabled:cursor-not-allowed min-h-[24px] max-h-[200px] overflow-y-auto"
        />

        {isStreaming ? (
          <button
            onClick={onStop}
            title="Stop generating"
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-all duration-200 border border-white/10"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            title="Send message"
            className={[
              "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
              canSend
                ? "bg-orange-500 hover:bg-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.45)] hover:shadow-[0_0_28px_rgba(249,115,22,0.6)] hover:scale-105 active:scale-95"
                : "bg-white/[0.05] text-zinc-600 cursor-not-allowed border border-white/[0.06]",
            ].join(" ")}
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
