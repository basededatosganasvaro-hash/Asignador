"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ErrorIcon from "@mui/icons-material/Error";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import CampaignIcon from "@mui/icons-material/Campaign";

interface Stats {
  mensajes: { hoy: number; semana: number; mes: number };
  porEstado: { estado: string; count: number }[];
  porPromotor: {
    usuario_id: number; nombre: string;
    enviados: number; entregados: number; leidos: number; fallidos: number;
  }[];
  sesionesActivas: number;
  campanasActivas: number;
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: "#9e9e9e",
  ENVIANDO: "#ff9800",
  ENVIADO: "#2196f3",
  ENTREGADO: "#4caf50",
  LEIDO: "#00bcd4",
  FALLIDO: "#f44336",
};

export default function WhatsAppAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
  );

  if (!stats) return (
    <Box sx={{ textAlign: "center", mt: 8 }}>
      <Typography color="text.secondary">Error al cargar estadísticas</Typography>
    </Box>
  );

  const statCards = [
    { label: "Enviados Hoy", value: stats.mensajes.hoy, icon: <SendIcon />, color: "#2196f3" },
    { label: "Enviados Semana", value: stats.mensajes.semana, icon: <DoneAllIcon />, color: "#4caf50" },
    { label: "Enviados Mes", value: stats.mensajes.mes, icon: <CampaignIcon />, color: "#ff9800" },
    { label: "Sesiones Activas", value: stats.sesionesActivas, icon: <PhoneAndroidIcon />, color: "#25D366" },
    { label: "Campañas Activas", value: stats.campanasActivas, icon: <CampaignIcon />, color: "#9c27b0" },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 0.5 }}>WhatsApp - Analítica</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Monitoreo de envíos masivos de WhatsApp
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((card) => (
          <Grid size={{ xs: 6, md: 2.4 }} key={card.label}>
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <CardContent sx={{ textAlign: "center", py: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ color: card.color, mb: 0.5 }}>{card.icon}</Box>
                <Typography variant="h4" fontWeight={800} sx={{ color: card.color }}>
                  {card.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {card.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Por Estado */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                Mensajes por Estado (Mes)
              </Typography>
              {stats.porEstado.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Sin datos</Typography>
              ) : (
                stats.porEstado.map((e) => (
                  <Box key={e.estado} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Chip
                      label={e.estado}
                      size="small"
                      sx={{
                        bgcolor: ESTADO_COLORS[e.estado] || "grey.500",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    />
                    <Typography variant="body2" fontWeight={700}>{e.count}</Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Por Promotor */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                Top Promotores
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Promotor</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}>
                        <SendIcon sx={{ fontSize: 12, mr: 0.5 }} />Enviados
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}>
                        <DoneAllIcon sx={{ fontSize: 12, mr: 0.5 }} />Entregados
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}>
                        <VisibilityIcon sx={{ fontSize: 12, mr: 0.5 }} />Leídos
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}>
                        <ErrorIcon sx={{ fontSize: 12, mr: 0.5 }} />Fallidos
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.porPromotor.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">Sin datos</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.porPromotor.map((p) => (
                        <TableRow key={p.usuario_id}>
                          <TableCell sx={{ fontSize: 13 }}>{p.nombre}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, color: "#2196f3" }}>{p.enviados}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, color: "#4caf50" }}>{p.entregados}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, color: "#00bcd4" }}>{p.leidos}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, color: "#f44336" }}>{p.fallidos}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
