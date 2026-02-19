"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, LinearProgress, Chip, IconButton, Tooltip,
  Card, CardContent, Stack, Collapse,
} from "@mui/material";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CancelIcon from "@mui/icons-material/Cancel";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

interface Campana {
  id: number;
  nombre: string;
  estado: string;
  total_mensajes: number;
  enviados: number;
  entregados: number;
  leidos: number;
  fallidos: number;
  created_at: string;
}

const ESTADO_COLORS: Record<string, string> = {
  CREADA: "#9e9e9e",
  EN_COLA: "#ff9800",
  ENVIANDO: "#2196f3",
  PAUSADA: "#ff5722",
  COMPLETADA: "#4caf50",
  CANCELADA: "#f44336",
};

export default function CampanaProgreso() {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchCampanas = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/campanas");
      if (res.ok) setCampanas(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCampanas();
    const interval = setInterval(fetchCampanas, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [fetchCampanas]);

  const handleAction = async (campanaId: number, action: "pause" | "resume" | "cancel") => {
    try {
      await fetch(`/api/whatsapp/campanas/${campanaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchCampanas();
    } catch { /* ignore */ }
  };

  if (campanas.length === 0) return null;

  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
      <CardContent sx={{ pb: "12px !important" }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          Campañas WhatsApp
        </Typography>
        <Stack spacing={1}>
          {campanas.map((c) => {
            const pct = c.total_mensajes > 0 ? Math.round((c.enviados / c.total_mensajes) * 100) : 0;
            const isActive = ["EN_COLA", "ENVIANDO"].includes(c.estado);

            return (
              <Box key={c.id}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
                        {c.nombre}
                      </Typography>
                      <Chip
                        label={c.estado}
                        size="small"
                        sx={{
                          fontSize: 10, height: 20, fontWeight: 700,
                          bgcolor: ESTADO_COLORS[c.estado] || "grey.500",
                          color: "white",
                        }}
                      />
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        mt: 0.5, height: 6, borderRadius: 3,
                        bgcolor: "grey.100",
                        "& .MuiLinearProgress-bar": {
                          bgcolor: isActive ? "#25D366" : ESTADO_COLORS[c.estado],
                          borderRadius: 3,
                        },
                      }}
                    />
                    <Box sx={{ display: "flex", gap: 1.5, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{c.enviados}/{c.total_mensajes} enviados</Typography>
                      {c.entregados > 0 && (
                        <Typography variant="caption" sx={{ color: "#4caf50" }}>
                          <CheckCircleIcon sx={{ fontSize: 10, mr: 0.3 }} />{c.entregados} entregados
                        </Typography>
                      )}
                      {c.leidos > 0 && (
                        <Typography variant="caption" sx={{ color: "#2196f3" }}>
                          {c.leidos} leídos
                        </Typography>
                      )}
                      {c.fallidos > 0 && (
                        <Typography variant="caption" sx={{ color: "#f44336" }}>
                          <ErrorIcon sx={{ fontSize: 10, mr: 0.3 }} />{c.fallidos} fallidos
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {c.estado === "ENVIANDO" && (
                      <Tooltip title="Pausar">
                        <IconButton size="small" onClick={() => handleAction(c.id, "pause")}>
                          <PauseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {c.estado === "PAUSADA" && (
                      <Tooltip title="Reanudar">
                        <IconButton size="small" color="success" onClick={() => handleAction(c.id, "resume")}>
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isActive && (
                      <Tooltip title="Cancelar">
                        <IconButton size="small" color="error" onClick={() => handleAction(c.id, "cancel")}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton size="small" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                      {expanded === c.id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  </Box>
                </Box>

                <Collapse in={expanded === c.id}>
                  <Box sx={{ mt: 1, pl: 1, borderLeft: "3px solid", borderColor: "divider" }}>
                    <Typography variant="caption" color="text.secondary">
                      Creada: {new Date(c.created_at).toLocaleString("es-MX")}
                    </Typography>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
