"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Button, MenuItem, Select, FormControl, InputLabel,
  TextField, Pagination, Tooltip, Divider,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ErrorIcon from "@mui/icons-material/Error";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import CampaignIcon from "@mui/icons-material/Campaign";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";

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

interface Promotor { id: number; nombre: string; equipo_id: number | null }
interface Equipo { id: number; nombre: string }

interface Mensaje {
  id: number;
  nombre_cliente: string | null;
  numero_destino: string;
  estado: string;
  error_detalle: string | null;
  enviado_at: string | null;
  entregado_at: string | null;
  leido_at: string | null;
  created_at: string;
  campana_id: number;
  campana_nombre: string;
  promotor_id: number;
  promotor_nombre: string;
  equipo_id: number | null;
  equipo_nombre: string | null;
}

interface MensajesData {
  mensajes: Mensaje[];
  total: number;
  page: number;
  limit: number;
  promotores: Promotor[];
  equipos: Equipo[];
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: "#9e9e9e",
  ENVIANDO: "#ff9800",
  ENVIADO: "#2196f3",
  ENTREGADO: "#4caf50",
  LEIDO: "#00bcd4",
  FALLIDO: "#f44336",
};

const ESTADOS = ["PENDIENTE", "ENVIANDO", "ENVIADO", "ENTREGADO", "LEIDO", "FALLIDO"];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

export default function WhatsAppAdminPage() {
  // ─── Analytics ───
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // ─── Mensajes detalle ───
  const [mensajesData, setMensajesData] = useState<MensajesData | null>(null);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [filtroPromotor, setFiltroPromotor] = useState("");
  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const fetchMensajes = useCallback(async (p = 1) => {
    setLoadingMensajes(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (filtroPromotor) params.set("promotor_id", filtroPromotor);
      if (filtroEquipo) params.set("equipo_id", filtroEquipo);
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);
      const res = await fetch(`/api/admin/whatsapp/mensajes?${params}`);
      if (res.ok) setMensajesData(await res.json());
    } catch { /* ignore */ }
    setLoadingMensajes(false);
  }, [filtroPromotor, filtroEquipo, filtroEstado, filtroDesde, filtroHasta]);

  // Cargar lista de promotores/equipos al montar
  useEffect(() => {
    fetchMensajes(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuscar = () => {
    setPage(1);
    fetchMensajes(1);
  };

  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
    fetchMensajes(newPage);
  };

  if (loadingStats) return (
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

  const promotores = mensajesData?.promotores || [];
  const equipos = mensajesData?.equipos || [];
  const totalPages = mensajesData ? Math.ceil(mensajesData.total / LIMIT) : 0;

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

      <Grid container spacing={3} sx={{ mb: 3 }}>
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
                      sx={{ bgcolor: ESTADO_COLORS[e.estado] || "grey.500", color: "white", fontWeight: 700, fontSize: 11 }}
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
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Top Promotores</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Promotor</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}><SendIcon sx={{ fontSize: 12, mr: 0.5 }} />Enviados</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}><DoneAllIcon sx={{ fontSize: 12, mr: 0.5 }} />Entregados</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}><VisibilityIcon sx={{ fontSize: 12, mr: 0.5 }} />Leídos</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}><ErrorIcon sx={{ fontSize: 12, mr: 0.5 }} />Fallidos</TableCell>
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

      {/* ─── Detalle de Mensajes ─── */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <FilterListIcon sx={{ color: "text.secondary" }} />
            <Typography variant="subtitle2" fontWeight={700}>Detalle de Mensajes</Typography>
            {mensajesData && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                {mensajesData.total} resultado{mensajesData.total !== 1 ? "s" : ""}
              </Typography>
            )}
          </Box>

          {/* Filtros */}
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Promotor</InputLabel>
              <Select
                value={filtroPromotor}
                label="Promotor"
                onChange={(e) => setFiltroPromotor(e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {promotores.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Equipo</InputLabel>
              <Select
                value={filtroEquipo}
                label="Equipo"
                onChange={(e) => setFiltroEquipo(e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {equipos.map((e) => (
                  <MenuItem key={e.id} value={String(e.id)}>{e.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Estado</InputLabel>
              <Select
                value={filtroEstado}
                label="Estado"
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {ESTADOS.map((s) => (
                  <MenuItem key={s} value={s}>
                    <Chip label={s} size="small" sx={{ bgcolor: ESTADO_COLORS[s], color: "white", fontWeight: 700, fontSize: 11, height: 20 }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small" label="Desde" type="date"
              value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
              InputLabelProps={{ shrink: true }} sx={{ width: 150 }}
            />
            <TextField
              size="small" label="Hasta" type="date"
              value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
              InputLabelProps={{ shrink: true }} sx={{ width: 150 }}
            />

            <Button
              variant="contained" size="small"
              startIcon={loadingMensajes ? <CircularProgress size={14} color="inherit" /> : <SearchIcon />}
              onClick={handleBuscar}
              disabled={loadingMensajes}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Buscar
            </Button>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Tabla */}
          {loadingMensajes ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
          ) : (
            <>
              <TableContainer sx={{ maxHeight: 480 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Cliente</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Teléfono</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Promotor</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Equipo</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Campaña</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Estado</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Enviado</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Entregado</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Leído</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "grey.50" }}>Error</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!mensajesData || mensajesData.mensajes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">Sin mensajes</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      mensajesData.mensajes.map((m) => (
                        <TableRow key={m.id} hover>
                          <TableCell sx={{ fontSize: 12, maxWidth: 160 }}>
                            <Typography variant="body2" noWrap fontWeight={500}>
                              {m.nombre_cliente || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{m.numero_destino}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{m.promotor_nombre}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{m.equipo_nombre || "—"}</TableCell>
                          <TableCell sx={{ fontSize: 12, maxWidth: 140 }}>
                            <Tooltip title={m.campana_nombre}>
                              <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>
                                {m.campana_nombre}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={m.estado}
                              size="small"
                              sx={{
                                bgcolor: ESTADO_COLORS[m.estado] || "grey.500",
                                color: "white",
                                fontWeight: 700,
                                fontSize: 10,
                                height: 20,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: 11, color: "text.secondary" }}>{fmtDate(m.enviado_at)}</TableCell>
                          <TableCell sx={{ fontSize: 11, color: "text.secondary" }}>{fmtDate(m.entregado_at)}</TableCell>
                          <TableCell sx={{ fontSize: 11, color: "text.secondary" }}>{fmtDate(m.leido_at)}</TableCell>
                          <TableCell sx={{ fontSize: 11, maxWidth: 140 }}>
                            {m.error_detalle ? (
                              <Tooltip title={m.error_detalle}>
                                <Typography variant="body2" noWrap sx={{ fontSize: 11, color: "error.main" }}>
                                  {m.error_detalle}
                                </Typography>
                              </Tooltip>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {totalPages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    size="small"
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
