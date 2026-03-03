"use client";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  rol: "user" | "assistant";
  contenido: string;
  created_at?: string;
}

export default function ChatMessage({ rol, contenido, created_at }: ChatMessageProps) {
  const isUser = rol === "user";

  return (
    <div
      className={`flex items-start gap-2 mb-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-[18px] h-[18px] text-slate-950" />
        </div>
      )}
      <div
        className={`
          max-w-[75%] px-3 py-2.5 rounded-lg
          ${isUser
            ? "bg-amber-500 text-slate-950 rounded-tr-sm"
            : "bg-slate-800/60 text-slate-200 border border-slate-700/50 rounded-tl-sm"
          }
        `.trim()}
      >
        <p
          className={`
            text-sm whitespace-pre-wrap break-words
            [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs
            ${isUser ? "[&_code]:bg-white/15" : "[&_code]:bg-slate-700/60"}
          `.trim()}
        >
          {contenido}
        </p>
        {created_at && (
          <span
            className={`block text-xs mt-1 text-right ${
              isUser ? "text-slate-950/50" : "text-slate-500"
            }`}
          >
            {new Date(created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-1">
          <User className="w-[18px] h-[18px] text-slate-300" />
        </div>
      )}
    </div>
  );
}
