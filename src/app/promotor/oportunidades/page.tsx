"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box, Typography, Chip, CircularProgress, Alert, Stack,
  MenuItem, Select, FormControl, InputLabel, Switch,
  FormControlLabel, IconButton, Tooltip, Collapse, Button,
  Card, CardContent, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Paper, Divider, Grid,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import FilterListIcon from "@mui/icons-material/FilterList";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PhoneIcon from "@mui/icons-material/Phone";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

// ════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════

interface Oportunidad {
  id: number;
  cliente_id: number | null;
  nombres: string;
  convenio: string;
  estado: string;
  municipio: string;
  tipo_cliente: string;
  tel_1: string | null;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  timer_vence: string | null;
  origen: string;
  created_at: string;
}

interface Transicion {
  id: number;
  nombre_accion: string;
  requiere_nota: boolean;
  devuelve_al_pool: boolean;
  etapa_destino: { id: number; nombre: string; color: string; tipo: string } | null;
}

interface Etapa {
  id: number;
  nombre: string;
  orden: number;
  tipo: string;
  color: string;
  transiciones_origen: Transicion[];
}

interface OportunidadDetalle {
  id: number;
  cliente_id: number;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  timer_vence: string | null;
  activo: boolean;
  cliente: Record<string, string | null | undefined>;
  transiciones: Transicion[];
  historial: HistorialEntry[];
}

interface HistorialEntry {
  id: number;
  tipo: string;
  canal: string | null;
  nota: string | null;
  created_at: string;
  usuario: { id: number; nombre: string; rol: string };
  etapa_anterior: { id: number; nombre: string; color: string } | null;
  etapa_nueva: { id: number; nombre: string; color: string } | null;
}

const FILTROS_VACIOS = {
  tipoCliente: "", convenio: "", estado: "", municipio: "", soloConTel: false,
};

// ════════════════════════════════════════════
// CONFETTI
// ════════════════════════════════════════════

function ConfettiEffect({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);

  const particles = useMemo(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      color: ["#f44336", "#e91e63", "#9c27b0", "#673ab7", "#2196f3", "#4caf50", "#ff9800", "#ffeb3b", "#00bcd4"][i % 9],
      left: Math.random() * 100,
      delay: Math.random() * 1.8,
      duration: 2.2 + Math.random() * 2.5,
      size: 6 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 120,
    })),
  []);

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; top: -20px; }
          100% { opacity: 0; top: 110vh; }
        }
      `}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: -20,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              borderRadius: 2,
              animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
              transform: `translateX(${p.drift}px)`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
}

// ════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════

export default function OportunidadesPage() {
  const [rows, setRows] = useState<Oportunidad[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [etapaFiltro, setEtapaFiltro] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [showFiltros, setShowFiltros] = useState(false);
  const [observaciones, setObservaciones] = useState<Record<number, string>>({});
  const [transitioning, setTransitioning] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [confetti, setConfetti] = useState(false);

  // Modal Ver detalle
  const [verDialog, setVerDialog] = useState<{ open: boolean; loading: boolean; data: OportunidadDetalle | null }>({
    open: false, loading: false, data: null,
  });

  // Dialog num_operacion para Venta
  const [ventaDialog, setVentaDialog] = useState<{ open: boolean; opId: number; transId: number; numOp: string; saving: boolean }>({
    open: false, opId: 0, transId: 0, numOp: "", saving: false,
  });

  const fetchData = useCallback(async () => {
    const [resOps, resEtapas] = await Promise.all([
      fetch("/api/oportunidades"),
      fetch("/api/embudo/etapas"),
    ]);
    setRows(await resOps.json());
    setEtapas(await resEtapas.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFiltro = (key: keyof typeof FILTROS_VACIOS, value: string | boolean) =>
    setFiltros((p) => ({ ...p, [key]: value }));

  // Mapa de transiciones por etapa_id
  const transMap = useMemo(() => {
    const map: Record<number, Transicion[]> = {};
    etapas.forEach((e) => { map[e.id] = e.transiciones_origen; });
    return map;
  }, [etapas]);

  // Conteo por etapa
  const conteoPorEtapa = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => { map[r.etapa?.nombre ?? ""] = (map[r.etapa?.nombre ?? ""] || 0) + 1; });
    return map;
  }, [rows]);

  const etapasAvance = useMemo(() => etapas.filter((e) => e.tipo === "AVANCE" || (e.tipo === "FINAL" && e.nombre === "Venta")), [etapas]);
  const etapasSalida = useMemo(() => etapas.filter((e) => e.tipo === "SALIDA" || (e.tipo === "FINAL" && e.nombre !== "Venta")), [etapas]);

  const opts = useMemo(() => ({
    tiposCliente: Array.from(new Set(rows.map((r) => r.tipo_cliente).filter((v) => v && v !== "—"))).sort(),
    convenios: Array.from(new Set(rows.map((r) => r.convenio).filter((v) => v && v !== "—"))).sort(),
    estados: Array.from(new Set(rows.map((r) => r.estado).filter((v) => v && v !== "—"))).sort(),
    municipios: Array.from(new Set(
      rows.filter((r) => !filtros.estado || r.estado === filtros.estado)
        .map((r) => r.municipio).filter((v) => v && v !== "—")
    )).sort(),
  }), [rows, filtros.estado]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (etapaFiltro && r.etapa?.nombre !== etapaFiltro) return false;
    if (filtros.tipoCliente && r.tipo_cliente !== filtros.tipoCliente) return false;
    if (filtros.convenio && r.convenio !== filtros.convenio) return false;
    if (filtros.estado && r.estado !== filtros.estado) return false;
    if (filtros.municipio && r.municipio !== filtros.municipio) return false;
    if (filtros.soloConTel && !r.tel_1) return false;
    return true;
  }), [rows, etapaFiltro, filtros]);

  const hayFiltros = Object.values(filtros).some((v) => v !== "" && v !== false);

  // ─── Cambiar etapa inline ───
  const handleTransicion = async (opId: number, transicionId: number) => {
    const trans = etapas.flatMap((e) => e.transiciones_origen).find((t) => t.id === transicionId);
    if (!trans) return;

    // Si es Venta → pedir num_operacion primero
    if (trans.etapa_destino?.tipo === "FINAL" && trans.etapa_destino?.nombre === "Venta") {
      setVentaDialog({ open: true, opId, transId: transicionId, numOp: "", saving: false });
      return;
    }

    await executeTransicion(opId, transicionId);
  };

  const executeTransicion = async (opId: number, transicionId: number, numOperacion?: string) => {
    setTransitioning(opId);
    const res = await fetch(`/api/oportunidades/${opId}/transicion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transicion_id: transicionId,
        nota: observaciones[opId] || undefined,
        num_operacion: numOperacion || undefined,
      }),
    });
    setTransitioning(null);

    if (res.ok) {
      const result = await res.json();
      if (result.confetti) {
        setConfetti(true);
        setSnackbar({ open: true, message: "¡Venta registrada!", severity: "success" });
      } else if (result.devuelta_al_pool) {
        setSnackbar({ open: true, message: "Oportunidad devuelta al pool", severity: "success" });
      } else {
        setSnackbar({ open: true, message: "Etapa actualizada", severity: "success" });
      }
      // Limpiar observaciones de esta fila
      setObservaciones((p) => { const next = { ...p }; delete next[opId]; return next; });
      fetchData();
    } else {
      const err = await res.json();
      setSnackbar({ open: true, message: err.error || "Error al cambiar etapa", severity: "error" });
    }
  };

  const handleVentaConfirm = async () => {
    setVentaDialog((p) => ({ ...p, saving: true }));
    await executeTransicion(ventaDialog.opId, ventaDialog.transId, ventaDialog.numOp);
    setVentaDialog({ open: false, opId: 0, transId: 0, numOp: "", saving: false });
  };

  // ─── Modal Ver detalle ───
  const openVerDialog = async (opId: number) => {
    setVerDialog({ open: true, loading: true, data: null });
    const res = await fetch(`/api/oportunidades/${opId}`);
    if (res.ok) {
      setVerDialog({ open: true, loading: false, data: await res.json() });
    } else {
      setVerDialog({ open: false, loading: false, data: null });
      setSnackbar({ open: true, message: "Error al cargar detalle", severity: "error" });
    }
  };

  // ─── Columnas DataGrid ───
  const columns: GridColDef[] = [
    {
      field: "nombres", headerName: "Cliente", flex: 1.3, minWidth: 160,
      renderCell: (p) => (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <Typography variant="body2" fontWeight={600} noWrap>{p.value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.tipo_cliente}</Typography>
        </Box>
      ),
    },
    {
      field: "convenio", headerName: "Convenio", flex: 0.9, minWidth: 120,
      renderCell: (p) => <Typography variant="body2" noWrap>{p.value}</Typography>,
    },
    {
      field: "estado", headerName: "Ubicación", width: 150,
      renderCell: (p) => (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <Typography variant="body2" noWrap>{p.value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.municipio}</Typography>
        </Box>
      ),
    },
    {
      field: "tel_1", headerName: "Teléfono", width: 130,
      renderCell: (p) => p.value
        ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PhoneIcon sx={{ fontSize: 13, color: "success.main" }} />
            <Typography variant="body2">{p.value}</Typography>
          </Box>
        )
        : <Typography variant="body2" color="text.disabled">—</Typography>,
    },
    {
      field: "etapa", headerName: "Etapa", width: 180, sortable: false,
      renderCell: (p) => {
        const etapa = p.row.etapa;
        if (!etapa) return <Chip label="Sin etapa" size="small" />;
        const trans = transMap[etapa.id] || [];
        const isLoading = transitioning === p.row.id;

        if (isLoading) {
          return <CircularProgress size={20} />;
        }

        if (trans.length === 0) {
          return <Chip label={etapa.nombre} size="small" sx={{ bgcolor: etapa.color, color: "white", fontWeight: 600 }} />;
        }

        return (
          <FormControl size="small" fullWidth>
            <Select
              value=""
              displayEmpty
              renderValue={() => (
                <Chip label={etapa.nombre} size="small" sx={{ bgcolor: etapa.color, color: "white", fontWeight: 600 }} />
              )}
              onChange={(e) => handleTransicion(p.row.id, Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              sx={{
                "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                "& .MuiSelect-select": { py: 0.5, pl: 0 },
              }}
            >
              {trans.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {t.etapa_destino && (
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: t.etapa_destino.color, flexShrink: 0 }} />
                    )}
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{t.nombre_accion}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t.etapa_destino ? `→ ${t.etapa_destino.nombre}` : "→ Pool"}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      },
    },
    {
      field: "__obs", headerName: "Observaciones", flex: 1, minWidth: 150, sortable: false,
      renderCell: (p) => (
        <TextField
          size="small"
          variant="standard"
          placeholder="Nota opcional..."
          fullWidth
          value={observaciones[p.row.id] || ""}
          onChange={(e) => setObservaciones((prev) => ({ ...prev, [p.row.id]: e.target.value }))}
          onClick={(e) => e.stopPropagation()}
          InputProps={{ disableUnderline: true, sx: { fontSize: 13 } }}
          sx={{ "& input": { py: 0.5 } }}
        />
      ),
    },
    {
      field: "__ver", headerName: "", width: 70, sortable: false,
      renderCell: (p) => (
        <Tooltip title="Ver detalle del cliente">
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => { e.stopPropagation(); openVerDialog(p.row.id); }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
  );

  return (
    <Box>
      {confetti && <ConfettiEffect onDone={() => setConfetti(false)} />}

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Mi Asignación</Typography>
        <Typography variant="body2" color="text.secondary">
          {rows.length} oportunidades activas
        </Typography>
      </Box>

      {rows.length === 0 ? (
        <Alert severity="info">
          No tienes oportunidades activas. Solicita una asignación desde el Dashboard.
        </Alert>
      ) : (
        <>
          {/* ═══════ EMBUDO VISUAL ═══════ */}
          <Card
            elevation={0}
            sx={{
              mb: 3, borderRadius: 3, overflow: "hidden",
              border: "1px solid", borderColor: "divider",
              background: "linear-gradient(135deg, #fafbfc 0%, #f0f4f8 100%)",
            }}
          >
            <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
              <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={1.5}>
                Embudo de ventas
              </Typography>
            </Box>

            {/* Pipeline AVANCE + Venta */}
            <Box
              sx={{
                display: "flex", alignItems: "center", gap: 0.5,
                px: 3, pb: 2, overflowX: "auto",
                "&::-webkit-scrollbar": { height: 4 },
                "&::-webkit-scrollbar-thumb": { bgcolor: "grey.300", borderRadius: 2 },
              }}
            >
              {etapasAvance.map((e, i) => {
                const count = conteoPorEtapa[e.nombre] || 0;
                const isSelected = etapaFiltro === e.nombre;
                return (
                  <Box key={e.id} sx={{ display: "flex", alignItems: "center" }}>
                    {i > 0 && <ChevronRightIcon sx={{ color: "grey.400", fontSize: 20, mx: 0.3, flexShrink: 0 }} />}
                    <Paper
                      elevation={isSelected ? 4 : 0}
                      onClick={() => setEtapaFiltro(isSelected ? "" : e.nombre)}
                      sx={{
                        px: 2.5, py: 1.5, textAlign: "center", cursor: "pointer",
                        minWidth: 110, borderRadius: 2.5,
                        bgcolor: isSelected ? e.color : "background.paper",
                        color: isSelected ? "white" : "text.primary",
                        border: "2px solid",
                        borderColor: isSelected ? e.color : count > 0 ? e.color : "grey.200",
                        "&:hover": { bgcolor: isSelected ? e.color : `${e.color}15`, borderColor: e.color, transform: "translateY(-2px)", boxShadow: 3 },
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.1, color: isSelected ? "white" : e.color }}>
                        {count}
                      </Typography>
                      <Typography variant="caption" fontWeight={600} sx={{ mt: 0.3, display: "block", color: isSelected ? "rgba(255,255,255,0.9)" : "text.secondary", whiteSpace: "nowrap" }}>
                        {e.nombre}
                      </Typography>
                    </Paper>
                  </Box>
                );
              })}
            </Box>

            {/* Salidas */}
            {etapasSalida.length > 0 && (
              <Box sx={{ display: "flex", gap: 1, px: 3, pb: 2, pt: 0.5, flexWrap: "wrap", borderTop: "1px solid", borderColor: "divider", bgcolor: "rgba(0,0,0,0.015)" }}>
                <Typography variant="caption" color="text.disabled" sx={{ alignSelf: "center", mr: 0.5 }}>Salidas:</Typography>
                {etapasSalida.map((e) => {
                  const count = conteoPorEtapa[e.nombre] || 0;
                  const isSelected = etapaFiltro === e.nombre;
                  return (
                    <Chip
                      key={e.id}
                      label={`${e.nombre} (${count})`}
                      size="small"
                      onClick={() => setEtapaFiltro(isSelected ? "" : e.nombre)}
                      sx={{
                        fontWeight: 600, fontSize: 11, cursor: "pointer",
                        bgcolor: isSelected ? e.color : "transparent",
                        color: isSelected ? "white" : count > 0 ? e.color : "text.disabled",
                        border: "1px solid", borderColor: isSelected ? e.color : count > 0 ? e.color : "grey.300",
                        "&:hover": { bgcolor: isSelected ? e.color : `${e.color}20`, borderColor: e.color },
                        transition: "all 0.15s",
                      }}
                    />
                  );
                })}
              </Box>
            )}
          </Card>

          {/* ═══════ FILTROS + GRID ═══════ */}
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
            {/* Barra de filtros */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", px: 2.5, py: 1.5, bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider" }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel shrink>Etapa</InputLabel>
                <Select value={etapaFiltro} label="Etapa" notched displayEmpty onChange={(e) => setEtapaFiltro(e.target.value)}>
                  <MenuItem value=""><em>Todas las etapas ({rows.length})</em></MenuItem>
                  {etapas.map((e) => (
                    <MenuItem key={e.id} value={e.nombre}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: e.color, flexShrink: 0 }} />
                        <Typography variant="body2">{e.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>{conteoPorEtapa[e.nombre] || 0}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </Typography>

              {hayFiltros && (
                <Button size="small" onClick={() => setFiltros(FILTROS_VACIOS)} startIcon={<FilterListOffIcon />}>Limpiar</Button>
              )}
              <Tooltip title="Más filtros">
                <IconButton size="small" onClick={() => setShowFiltros((p) => !p)} color={showFiltros ? "primary" : "default"}>
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Filtros avanzados */}
            <Collapse in={showFiltros}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, p: 2, bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider" }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel shrink>Tipo de cliente</InputLabel>
                  <Select value={filtros.tipoCliente} label="Tipo de cliente" notched displayEmpty onChange={(e) => setFiltro("tipoCliente", e.target.value)}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    {opts.tiposCliente.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 190 }}>
                  <InputLabel shrink>Convenio</InputLabel>
                  <Select value={filtros.convenio} label="Convenio" notched displayEmpty onChange={(e) => setFiltro("convenio", e.target.value)}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    {opts.convenios.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel shrink>Estado</InputLabel>
                  <Select value={filtros.estado} label="Estado" notched displayEmpty onChange={(e) => { setFiltro("estado", e.target.value); setFiltro("municipio", ""); }}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    {opts.estados.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }} disabled={!filtros.estado}>
                  <InputLabel shrink>Municipio</InputLabel>
                  <Select value={filtros.municipio} label="Municipio" notched displayEmpty onChange={(e) => setFiltro("municipio", e.target.value)}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    {opts.municipios.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControlLabel control={<Switch checked={filtros.soloConTel} onChange={(e) => setFiltro("soloConTel", e.target.checked)} size="small" />} label="Solo con teléfono" sx={{ ml: 0.5 }} />
              </Box>
            </Collapse>

            {/* DataGrid */}
            {filtered.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
                <Typography>Sin oportunidades en esta etapa</Typography>
              </Box>
            ) : (
              <DataGrid
                rows={filtered}
                columns={columns}
                pageSizeOptions={[25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                disableRowSelectionOnClick
                autoHeight
                rowHeight={56}
                sx={{
                  border: "none",
                  "& .MuiDataGrid-columnHeader": {
                    bgcolor: "background.paper", fontSize: 11, fontWeight: 700,
                    color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em",
                  },
                  "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
                  "& .MuiDataGrid-cell": { borderColor: "grey.100", display: "flex", alignItems: "center" },
                  "& .MuiDataGrid-footerContainer": { borderColor: "grey.100" },
                  "& .MuiDataGrid-columnSeparator": { color: "grey.200" },
                }}
              />
            )}
          </Card>
        </>
      )}

      {/* ═══════ DIALOG: NUM OPERACIÓN (VENTA) ═══════ */}
      <Dialog open={ventaDialog.open} onClose={() => setVentaDialog((p) => ({ ...p, open: false }))} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>
          <Typography variant="h6" fontWeight={700}>Registrar Venta</Typography>
          <Typography variant="body2" color="text.secondary">Ingresa el número de operación para completar la venta</Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Número de operación"
            value={ventaDialog.numOp}
            onChange={(e) => setVentaDialog((p) => ({ ...p, numOp: e.target.value }))}
            margin="dense"
            size="small"
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVentaDialog((p) => ({ ...p, open: false }))}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleVentaConfirm}
            disabled={ventaDialog.saving || !ventaDialog.numOp.trim()}
          >
            {ventaDialog.saving ? <CircularProgress size={20} color="inherit" /> : "Registrar Venta"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════ DIALOG: VER DETALLE ═══════ */}
      <Dialog
        open={verDialog.open}
        onClose={() => setVerDialog({ open: false, loading: false, data: null })}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Detalle del Cliente</Typography>
          {verDialog.data?.etapa && (
            <Chip label={verDialog.data.etapa.nombre} size="small" sx={{ bgcolor: verDialog.data.etapa.color, color: "white", fontWeight: 600 }} />
          )}
        </DialogTitle>
        <DialogContent>
          {verDialog.loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : verDialog.data ? (
            <Grid container spacing={3} sx={{ mt: 0 }}>
              {/* Datos del cliente */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>
                      Información del cliente
                    </Typography>
                    <Stack spacing={1.2}>
                      <DetailRow label="Nombre" value={verDialog.data.cliente.nombres} />
                      <DetailRow label="Convenio" value={verDialog.data.cliente.convenio} />
                      <DetailRow label="Estado" value={verDialog.data.cliente.estado} />
                      <DetailRow label="Municipio" value={verDialog.data.cliente.municipio} />
                      <DetailRow label="Oferta" value={verDialog.data.cliente.oferta} />
                      <Divider />
                      <DetailRow label="Tel 1" value={verDialog.data.cliente.tel_1} />
                      <DetailRow label="Tel 2" value={verDialog.data.cliente.tel_2} />
                      <DetailRow label="CURP" value={verDialog.data.cliente.curp} />
                      <DetailRow label="RFC" value={verDialog.data.cliente.rfc} />
                      <DetailRow label="NSS" value={verDialog.data.cliente.nss} />
                      <DetailRow label="Num. Empleado" value={verDialog.data.cliente.num_empleado} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Historial */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>
                      Historial
                    </Typography>
                    {verDialog.data.historial.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">Sin historial aún.</Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        {verDialog.data.historial.map((entry) => (
                          <Box key={entry.id} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                            <Box sx={{
                              width: 8, height: 8, borderRadius: "50%", mt: 0.8, flexShrink: 0,
                              bgcolor: entry.etapa_nueva?.color || "grey.400",
                            }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                                {entry.etapa_anterior && (
                                  <Chip label={entry.etapa_anterior.nombre} size="small"
                                    sx={{ height: 18, fontSize: 10, bgcolor: entry.etapa_anterior.color, color: "white" }} />
                                )}
                                {entry.etapa_anterior && entry.etapa_nueva && (
                                  <Typography variant="caption" color="text.secondary">→</Typography>
                                )}
                                {entry.etapa_nueva && (
                                  <Chip label={entry.etapa_nueva.nombre} size="small"
                                    sx={{ height: 18, fontSize: 10, bgcolor: entry.etapa_nueva.color, color: "white" }} />
                                )}
                              </Box>
                              {entry.nota && <Typography variant="body2" sx={{ mt: 0.3, fontSize: 12 }}>{entry.nota}</Typography>}
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                                {entry.usuario.nombre} · {new Date(entry.created_at).toLocaleString("es-MX")}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVerDialog({ open: false, loading: false, data: null })} startIcon={<ArrowBackIcon />}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500} sx={{ fontSize: 13 }}>{value || "—"}</Typography>
    </Box>
  );
}
