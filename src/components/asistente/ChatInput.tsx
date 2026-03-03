"use client";
import { useState, useRef } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (mensaje: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 items-end p-4 border-t border-slate-800/60">
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder="Escribe tu pregunta..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="
          flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700
          text-slate-200 placeholder-slate-600 rounded-lg text-sm
          focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60
          outline-none transition-all resize-none
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        style={{ maxHeight: "6rem" }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = "auto";
          target.style.height = Math.min(target.scrollHeight, 96) + "px";
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="
          p-2.5 rounded-lg transition-colors
          bg-amber-500 text-slate-950 hover:bg-amber-400
          shadow-lg shadow-amber-500/20
          disabled:opacity-50 disabled:cursor-not-allowed
          disabled:shadow-none
        "
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}
