"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Card, CardContent, Chip, Alert,
} from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import WhatsAppQRDialog from "@/components/WhatsAppQRDialog";
import WhatsAppGuiaModal from "@/components/WhatsAppGuiaModal";
import CampanaProgreso from "@/components/CampanaProgreso";

interface WaStatus {
  estado: string;
  numero_wa: string | null;
  ultimo_uso: string | null;
  activo_en_memoria: boolean;
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [guiaOpen, setGuiaOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("wa_guia_vista")) setGuiaOpen(true);
  }, []);

  const handleGuiaClose = () => {
    localStorage.setItem("wa_guia_vista", "1");
    setGuiaOpen(false);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/sesion/estado");
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/whatsapp/sesion/disconnect", { method: "POST" });
      await fetchStatus();
    } catch { /* ignore */ }
    setDisconnecting(false);
  };

  const isConnected = status?.estado === "CONECTADO";

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
        <Typography variant="h5" fontWeight={600}>WhatsApp Masivo</Typography>
        <Tooltip title="Estrategias anti-bloqueo">
          <IconButton size="small" onClick={() => setGuiaOpen(true)}>
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Envía mensajes masivos a tus clientes desde tu WhatsApp
      </Typography>

      {/* Estado de conexión */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <PhoneAndroidIcon sx={{ fontSize: 40, color: isConnected ? "#25D366" : "grey.400" }} />
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>WhatsApp</Typography>
              <Chip
                label={isConnected ? "Conectado" : status?.estado || "Desconectado"}
                size="small"
                sx={{
                  fontWeight: 700,
                  bgcolor: isConnected ? "#25D366" : "grey.300",
                  color: isConnected ? "white" : "text.primary",
                }}
              />
            </Box>
            {isConnected && status?.numero_wa && (
              <Typography variant="body2" color="text.secondary">
                Número: +{status.numero_wa}
              </Typography>
            )}
            {status?.ultimo_uso && (
              <Typography variant="caption" color="text.secondary">
                Último uso: {new Date(status.ultimo_uso).toLocaleString("es-MX")}
              </Typography>
            )}
          </Box>

          {isConnected ? (
            <Button
              variant="outlined" color="error" size="small"
              startIcon={<LinkOffIcon />}
              onClick={handleDisconnect}
              disabled={disconnecting}
              sx={{ textTransform: "none" }}
            >
              Desconectar
            </Button>
          ) : (
            <Button
              variant="contained" size="small"
              startIcon={<WhatsAppIcon />}
              onClick={() => setQrOpen(true)}
              sx={{ textTransform: "none", bgcolor: "#25D366", "&:hover": { bgcolor: "#1da851" } }}
            >
              Conectar WhatsApp
            </Button>
          )}
        </CardContent>
      </Card>

      {!isConnected && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Conecta tu WhatsApp para poder enviar mensajes masivos. Ve a &quot;Mi Asignación&quot;,
          selecciona clientes y usa el botón &quot;Enviar WhatsApp Masivo&quot;.
        </Alert>
      )}

      {/* Campañas activas */}
      <CampanaProgreso />

      {/* Guía anti-bloqueo */}
      <WhatsAppGuiaModal open={guiaOpen} onClose={handleGuiaClose} />

      {/* QR Dialog */}
      <WhatsAppQRDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onConnected={() => { setQrOpen(false); fetchStatus(); }}
      />
    </Box>
  );
}
