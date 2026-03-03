"use client";
import ChatPanel from "@/components/asistente/ChatPanel";

export default function AsistentePage() {
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-slate-100 mb-4">
        Asistente IA
      </h2>
      <ChatPanel />
    </div>
  );
}
