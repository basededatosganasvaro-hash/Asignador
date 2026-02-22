"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Paper, Typography, CircularProgress } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
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
      }
    } catch { /* ignore */ }
    setConvLoading(false);
  }, []);

  useEffect(() => { fetchConversaciones(); }, [fetchConversaciones]);

  // Fetch mensajes de una conversación
  const fetchMensajes = async (convId: number) => {
    try {
      const res = await fetch(`/api/asistente/conversaciones/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.mensajes || []);
      }
    } catch { /* ignore */ }
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
    await fetch(`/api/asistente/conversaciones/${id}`, { method: "DELETE" });
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
    fetchConversaciones();
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

      if (res.ok) {
        const data = await res.json();
        // Si era nueva conversación, setear el ID
        if (!activeConvId) {
          setActiveConvId(data.conversacion_id);
        }
        // Agregar respuesta del asistente
        setMessages((prev) => [...prev, data.mensaje]);
        fetchConversaciones();
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  };

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 100px)", gap: 2 }}>
      {/* Panel izquierdo: lista de conversaciones */}
      <Paper
        variant="outlined"
        sx={{
          width: 280, flexShrink: 0, overflow: "hidden",
          display: { xs: "none", md: "flex" }, flexDirection: "column",
        }}
      >
        <ConversationList
          conversaciones={conversaciones}
          activeId={activeConvId}
          loading={convLoading}
          onSelect={handleSelectConv}
          onNew={handleNewConv}
          onDelete={handleDeleteConv}
        />
      </Paper>

      {/* Panel derecho: chat */}
      <Paper variant="outlined" sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Mensajes */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
          {messages.length === 0 && !isLoading ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5 }}>
              <SmartToyIcon sx={{ fontSize: 64, mb: 2, color: "primary.main" }} />
              <Typography variant="h6" color="text.secondary">
                Asistente IA
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: "center", maxWidth: 400 }}>
                Pregunta sobre datos de ventas, clientes, promotores, o cualquier información del sistema.
              </Typography>
            </Box>
          ) : (
            <>
              {messages.map((msg) => (
                <Box key={msg.id}>
                  <ChatMessage rol={msg.rol} contenido={msg.contenido} created_at={msg.created_at} />
                  {/* Renderizar gráfica si existe en metadata */}
                  {msg.rol === "assistant" && msg.metadata_json &&
                    (msg.metadata_json as Record<string, unknown>).chart ? (
                    <ChartRenderer config={(msg.metadata_json as Record<string, unknown>).chart as Parameters<typeof ChartRenderer>[0]["config"]} />
                  ) : null}
                </Box>
              ))}
              {isLoading && (
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: 5, mb: 2 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Pensando...
                  </Typography>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </Box>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </Paper>
    </Box>
  );
}
