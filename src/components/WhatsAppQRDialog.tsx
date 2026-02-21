"use client";
import { useState, useEffect, useRef, useCallback } from "react";
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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
      return;
    }

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
      });

    // 2. Poll status every 2 seconds
    const poll = async () => {
      try {
        const res = await fetch("/api/whatsapp/sesion/estado");
        if (!res.ok) return;
        const data = await res.json();

        if (data.estado === "CONECTADO") {
          setStatus("connected");
          stopPolling();
          setTimeout(() => onConnected(), 1500);
        } else if (data.estado === "QR_PENDIENTE" && data.qr_code) {
          setStatus("qr");
          setQrData(data.qr_code);
        } else if (data.estado === "DESCONECTADO") {
          setStatus("error");
          setError("WhatsApp se desconectó. Intenta de nuevo.");
          stopPolling();
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Poll immediately, then every 2s
    poll();
    pollingRef.current = setInterval(poll, 2000);

    return () => stopPolling();
  }, [open, onConnected, stopPolling]);

  const handleClose = () => {
    stopPolling();
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
