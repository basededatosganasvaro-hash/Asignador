"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Bot } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import ConversationList from "./ConversationList";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import ChartRenderer from "./ChartRenderer";

interface Mensaje {
  id: number;
  rol: "user" | "assistant";
  contenido: string;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
}

interface Conversacion {
  id: number;
  titulo: string | null;
  updated_at: string;
  _count: { mensajes: number };
}

export default function ChatPanel() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Mensaje[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [convLoading, setConvLoading] = useState(true);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Fetch conversaciones
  const fetchConversaciones = useCallback(async () => {
    setConvLoading(true);
    try {
      const res = await fetch("/api/asistente/conversaciones");
      if (res.ok) {
        const data = await res.json();
        setConversaciones(data.conversaciones);
      } else {
        toast("Error al cargar conversaciones", "error");
      }
    } catch {
      toast("Error al cargar conversaciones", "error");
    }
    setConvLoading(false);
  }, [toast]);

  useEffect(() => { fetchConversaciones(); }, [fetchConversaciones]);

  // Fetch mensajes de una conversación
  const fetchMensajes = async (convId: number) => {
    try {
      const res = await fetch(`/api/asistente/conversaciones/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.mensajes || []);
      } else {
        toast("Error al cargar mensajes", "error");
      }
    } catch {
      toast("Error al cargar mensajes", "error");
    }
  };

  const handleSelectConv = (id: number) => {
    setActiveConvId(id);
    setMessages([]);
    fetchMensajes(id);
  };

  const handleNewConv = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const handleDeleteConv = async (id: number) => {
    try {
      await fetch(`/api/asistente/conversaciones/${id}`, { method: "DELETE" });
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
      fetchConversaciones();
    } catch {
      toast("Error al eliminar conversacion", "error");
    }
  };

  const handleSend = async (mensaje: string) => {
    // Agregar mensaje del usuario optimistamente
    const tempUserMsg: Mensaje = {
      id: Date.now(),
      rol: "user",
      contenido: mensaje,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje, conversacion_id: activeConvId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Error al enviar mensaje", "error");
        setIsLoading(false);
        return;
      }

      // Si era nueva conversación, setear el ID
      if (!activeConvId) {
        setActiveConvId(data.conversacion_id);
      }
      // Agregar respuesta del asistente
      setMessages((prev) => [...prev, data.mensaje]);
      fetchConversaciones();
    } catch {
      toast("Error de conexion con el servidor", "error");
    }
    setIsLoading(false);
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-3">
      {/* Panel izquierdo: lista de conversaciones */}
      <div className="hidden md:flex w-[280px] shrink-0 overflow-hidden flex-col bg-surface rounded-xl border border-slate-800/60">
        <ConversationList
          conversaciones={conversaciones}
          activeId={activeConvId}
          loading={convLoading}
          onSelect={handleSelectConv}
          onNew={handleNewConv}
          onDelete={handleDeleteConv}
        />
      </div>

      {/* Panel derecho: chat */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface rounded-xl border border-slate-800/60">
        {/* Mensajes */}
        <div className="flex-1 overflow-auto p-4">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
              <Bot className="w-16 h-16 mb-4 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-400">
                Asistente IA
              </h3>
              <p className="text-sm text-slate-500 mt-2 text-center max-w-[400px]">
                Pregunta sobre datos de ventas, clientes, promotores, o cualquier informacion del sistema.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id}>
                  <ChatMessage rol={msg.rol} contenido={msg.contenido} created_at={msg.created_at} />
                  {/* Renderizar grafica si existe en metadata */}
                  {msg.rol === "assistant" && msg.metadata_json &&
                    (msg.metadata_json as Record<string, unknown>).chart ? (
                    <ChartRenderer config={(msg.metadata_json as Record<string, unknown>).chart as Parameters<typeof ChartRenderer>[0]["config"]} />
                  ) : null}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 items-center ml-10 mb-4">
                  <Spinner size="sm" />
                  <span className="text-sm text-slate-500">
                    Pensando...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}
