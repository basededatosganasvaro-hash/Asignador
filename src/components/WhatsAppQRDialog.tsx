"use client";
import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, Alert,
} from "@mui/material";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export default function WhatsAppQRDialog({ open, onClose, onConnected }: Props) {
  const [status, setStatus] = useState<"connecting" | "qr" | "connected" | "error">("connecting");
  const [qrData, setQrData] = useState<string>("");
  const [error, setError] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!open) return;

    setStatus("connecting");
    setQrData("");
    setError("");

    // 1. Trigger connection
    fetch("/api/whatsapp/sesion/connect", { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Error al iniciar conexión");
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message);
        return;
      });

    // 2. Listen for QR events via SSE
    const es = new EventSource("/api/whatsapp/sesion/qr");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "qr") {
          setStatus("qr");
          setQrData(data.data);
        } else if (data.type === "connected") {
          setStatus("connected");
          setTimeout(() => {
            onConnected();
          }, 1500);
        } else if (data.type === "disconnected") {
          setStatus("error");
          setError("Sesión cerrada");
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      // SSE disconnected, check if already connected
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [open, onConnected]);

  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
        <QrCode2Icon sx={{ fontSize: 40, color: "#25D366", mb: 1 }} />
        <Typography variant="h6" fontWeight={700}>Conectar WhatsApp</Typography>
        <Typography variant="body2" color="text.secondary">
          Escanea el código QR con tu WhatsApp
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ textAlign: "center", pb: 2 }}>
        {status === "connecting" && (
          <Box sx={{ py: 4 }}>
            <CircularProgress sx={{ color: "#25D366" }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Generando código QR...
            </Typography>
          </Box>
        )}

        {status === "qr" && qrData && (
          <Box sx={{ py: 2 }}>
            <Box
              component="img"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}`}
              alt="QR Code"
              sx={{ width: 256, height: 256, mx: "auto", borderRadius: 2, border: "4px solid #25D366" }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
              Abre WhatsApp {">"} Dispositivos vinculados {">"} Vincular dispositivo
            </Typography>
          </Box>
        )}

        {status === "connected" && (
          <Box sx={{ py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: "#25D366" }} />
            <Typography variant="h6" fontWeight={600} sx={{ mt: 1, color: "#25D366" }}>
              Conectado
            </Typography>
          </Box>
        )}

        {status === "error" && (
          <Alert severity="error" sx={{ mt: 2 }}>{error || "Error de conexión"}</Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: "center" }}>
        <Button onClick={handleClose} color="error" variant="outlined">
          Cancelar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
