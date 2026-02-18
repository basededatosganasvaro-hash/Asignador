"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Chip, CircularProgress, Alert, Stack,
  MenuItem, Select, FormControl, InputLabel, Switch,
  FormControlLabel, IconButton, Tooltip, Collapse, Button,
  Card, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Snackbar, Paper,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import FilterListIcon from "@mui/icons-material/FilterList";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PhoneIcon from "@mui/icons-material/Phone";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

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

interface Etapa {
  id: number;
  nombre: string;
  orden: number;
  tipo: string;
  color: string;
}

interface Transicion {
  id: number;
  nombre_accion: string;
  requiere_nota: boolean;
  requiere_supervisor: boolean;
  devuelve_al_pool: boolean;
  etapa_destino: { id: number; nombre: string; color: string; tipo: string } | null;
}

const FILTROS_VACIOS = {
  tipoCliente: "", convenio: "", estado: "", municipio: "", soloConTel: false,
};

const DIALOG_INIT = {
  open: false, opId: 0, loadingTrans: false,
  transiciones: [] as Transicion[],
  step: 1 as 1 | 2,
  selected: null as Transicion | null,
  canal: "", nota: "", numOp: "", saving: false,
};

export default function OportunidadesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Oportunidad[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [etapaFiltro, setEtapaFiltro] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [showFiltros, setShowFiltros] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [td, setTd] = useState(DIALOG_INIT);

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

  // Conteo por etapa
  const conteoPorEtapa = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      const nombre = r.etapa?.nombre ?? "__sin_etapa__";
      map[nombre] = (map[nombre] || 0) + 1;
    });
    return map;
  }, [rows]);

  // Separar etapas de avance y salida/final
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

  // — Transiciones —
  const openTransDialog = async (opId: number) => {
    setTd({ ...DIALOG_INIT, open: true, opId, loadingTrans: true });
    const res = await fetch(`/api/oportunidades/${opId}`);
    if (res.ok) {
      const data = await res.json();
      setTd((p) => ({ ...p, loadingTrans: false, transiciones: data.transiciones }));
    } else {
      setTd(DIALOG_INIT);
    }
  };

  const selectTransicion = (t: Transicion) =>
    setTd((p) => ({ ...p, selected: t, step: 2, canal: "", nota: "", numOp: "" }));

  const executeTransicion = async () => {
    if (!td.selected) return;
    setTd((p) => ({ ...p, saving: true }));
    const res = await fetch(`/api/oportunidades/${td.opId}/transicion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transicion_id: td.selected.id,
        canal: td.canal || undefined,
        nota: td.nota || undefined,
        num_operacion: td.numOp || undefined,
      }),
    });
    setTd(DIALOG_INIT);

    if (res.ok) {
      const result = await res.json();
      const msg = result.confetti
        ? "¡Venta registrada!"
        : result.devuelta_al_pool
        ? "Oportunidad devuelta al pool"
        : "Etapa actualizada";
      setSnackbar({ open: true, message: msg, severity: "success" });
      fetchData();
    } else {
      const err = await res.json();
      setSnackbar({ open: true, message: err.error || "Error", severity: "error" });
    }
  };

  const esVenta = td.selected?.etapa_destino?.tipo === "FINAL" && td.selected?.etapa_destino?.nombre === "Venta";
  const confirmDisabled = td.saving
    || (!!td.selected?.requiere_nota && !td.nota.trim())
    || (esVenta && !td.numOp.trim());

  // — Columnas del DataGrid —
  const columns: GridColDef[] = [
    {
      field: "nombres", headerName: "Cliente", flex: 1.5, minWidth: 170,
      renderCell: (p) => (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <Typography variant="body2" fontWeight={600} noWrap>{p.value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.tipo_cliente}</Typography>
        </Box>
      ),
    },
    {
      field: "convenio", headerName: "Convenio", flex: 1, minWidth: 130,
      renderCell: (p) => <Typography variant="body2" noWrap>{p.value}</Typography>,
    },
    {
      field: "estado", headerName: "Ubicación", width: 165,
      renderCell: (p) => (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <Typography variant="body2" noWrap>{p.value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.municipio}</Typography>
        </Box>
      ),
    },
    {
      field: "tel_1", headerName: "Teléfono", width: 145,
      renderCell: (p) => p.value
        ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PhoneIcon sx={{ fontSize: 13, color: "success.main" }} />
            <Typography variant="body2">{p.value}</Typography>
          </Box>
        )
        : <Typography variant="body2" color="text.disabled">Sin teléfono</Typography>,
    },
    {
      field: "etapa", headerName: "Etapa", width: 155, sortable: false,
      renderCell: (p) => {
        const etapa = p.row.etapa;
        if (!etapa) return <Chip label="Sin etapa" size="small" />;
        return (
          <Tooltip title="Cambiar etapa" placement="top">
            <Chip
              label={etapa.nombre}
              size="small"
              onClick={(e) => { e.stopPropagation(); openTransDialog(p.row.id); }}
              sx={{
                bgcolor: etapa.color, color: "white", fontWeight: 600,
                cursor: "pointer",
                "&:hover": { opacity: 0.82, transform: "scale(1.04)" },
                transition: "all 0.15s ease",
              }}
            />
          </Tooltip>
        );
      },
    },
    {
      field: "__ver", headerName: "", width: 80, sortable: false,
      renderCell: (p) => (
        <Button
          size="small"
          variant="outlined"
          startIcon={<VisibilityIcon sx={{ fontSize: "14px !important" }} />}
          onClick={(e) => { e.stopPropagation(); router.push(`/promotor/oportunidades/${p.row.id}`); }}
          sx={{ minWidth: 0, px: 1.5, py: 0.5, fontSize: 12 }}
        >
          Ver
        </Button>
      ),
    },
  ];

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Mis Oportunidades</Typography>
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

            {/* Pipeline principal (AVANCE + Venta) */}
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
                    {i > 0 && (
                      <ChevronRightIcon sx={{ color: "grey.400", fontSize: 20, mx: 0.3, flexShrink: 0 }} />
                    )}
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
                        "&:hover": {
                          bgcolor: isSelected ? e.color : `${e.color}15`,
                          borderColor: e.color,
                          transform: "translateY(-2px)",
                          boxShadow: 3,
                        },
                        transition: "all 0.2s ease",
                        position: "relative",
                      }}
                    >
                      <Typography
                        variant="h4"
                        fontWeight={800}
                        sx={{ lineHeight: 1.1, color: isSelected ? "white" : e.color }}
                      >
                        {count}
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        sx={{
                          mt: 0.3,
                          display: "block",
                          color: isSelected ? "rgba(255,255,255,0.9)" : "text.secondary",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.nombre}
                      </Typography>
                    </Paper>
                  </Box>
                );
              })}
            </Box>

            {/* Etapas de salida */}
            {etapasSalida.length > 0 && (
              <Box
                sx={{
                  display: "flex", gap: 1, px: 3, pb: 2, pt: 0.5,
                  flexWrap: "wrap", borderTop: "1px solid", borderColor: "divider",
                  bgcolor: "rgba(0,0,0,0.015)",
                }}
              >
                <Typography variant="caption" color="text.disabled" sx={{ alignSelf: "center", mr: 0.5 }}>
                  Salidas:
                </Typography>
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
                        border: "1px solid",
                        borderColor: isSelected ? e.color : count > 0 ? e.color : "grey.300",
                        "&:hover": {
                          bgcolor: isSelected ? e.color : `${e.color}20`,
                          borderColor: e.color,
                        },
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
            <Box
              sx={{
                display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
                px: 2.5, py: 1.5, bgcolor: "grey.50",
                borderBottom: "1px solid", borderColor: "divider",
              }}
            >
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel shrink>Etapa</InputLabel>
                <Select
                  value={etapaFiltro}
                  label="Etapa"
                  notched
                  displayEmpty
                  onChange={(e) => setEtapaFiltro(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Todas las etapas ({rows.length})</em>
                  </MenuItem>
                  {etapas.map((e) => (
                    <MenuItem key={e.id} value={e.nombre}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: e.color, flexShrink: 0 }} />
                        <Typography variant="body2">{e.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                          {conteoPorEtapa[e.nombre] || 0}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </Typography>

              {hayFiltros && (
                <Button size="small" onClick={() => setFiltros(FILTROS_VACIOS)} startIcon={<FilterListOffIcon />}>
                  Limpiar
                </Button>
              )}
              <Tooltip title="Más filtros">
                <IconButton
                  size="small"
                  onClick={() => setShowFiltros((p) => !p)}
                  color={showFiltros ? "primary" : "default"}
                >
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Filtros avanzados (colapsables) */}
            <Collapse in={showFiltros}>
              <Box sx={{
                display: "flex", flexWrap: "wrap", gap: 1.5,
                p: 2, bgcolor: "grey.50",
                borderBottom: "1px solid", borderColor: "divider",
              }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel shrink>Tipo de cliente</InputLabel>
                  <Select value={filtros.tipoCliente} label="Tipo de cliente" notched displayEmpty
                    onChange={(e) => setFiltro("tipoCliente", e.target.value)}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    {opts.tiposCliente.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 190 }}>
                  <InputLabel shrink>Convenio</InputLabel>
                  <Select value={filtros.convenio} label="Convenio" notched displayEmpty
                    onChange={(e) => setFiltro("convenio", e.target.value)}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    {opts.convenios.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel shrink>Estado</InputLabel>
                  <Select value={filtros.estado} label="Estado" notched displayEmpty
                    onChange={(e) => { setFiltro("estado", e.target.value); setFiltro("municipio", ""); }}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    {opts.estados.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }} disabled={!filtros.estado}>
                  <InputLabel shrink>Municipio</InputLabel>
                  <Select value={filtros.municipio} label="Municipio" notched displayEmpty
                    onChange={(e) => setFiltro("municipio", e.target.value)}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    {opts.municipios.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={<Switch checked={filtros.soloConTel} onChange={(e) => setFiltro("soloConTel", e.target.checked)} size="small" />}
                  label="Solo con teléfono"
                  sx={{ ml: 0.5 }}
                />
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
                    bgcolor: "background.paper",
                    fontSize: 11, fontWeight: 700,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  },
                  "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
                  "& .MuiDataGrid-cell": {
                    borderColor: "grey.100",
                    display: "flex", alignItems: "center",
                  },
                  "& .MuiDataGrid-footerContainer": { borderColor: "grey.100" },
                  "& .MuiDataGrid-columnSeparator": { color: "grey.200" },
                }}
              />
            )}
          </Card>
        </>
      )}

      {/* ═══════ DIALOG TRANSICIONES ═══════ */}
      <Dialog
        open={td.open}
        onClose={() => setTd(DIALOG_INIT)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {td.step === 1 ? (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Typography variant="h6" fontWeight={700}>Cambiar etapa</Typography>
              <Typography variant="caption" color="text.secondary">Oportunidad #{td.opId}</Typography>
            </DialogTitle>
            <DialogContent sx={{ pt: 0.5 }}>
              {td.loadingTrans ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : td.transiciones.length === 0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>No hay acciones disponibles para esta etapa.</Alert>
              ) : (
                <Stack spacing={1} sx={{ mt: 0.5 }}>
                  {td.transiciones.map((t) => (
                    <Button
                      key={t.id}
                      variant="outlined"
                      fullWidth
                      onClick={() => selectTransicion(t)}
                      color={t.devuelve_al_pool ? "error" : t.etapa_destino?.tipo === "FINAL" ? "success" : "primary"}
                      sx={{
                        justifyContent: "flex-start", textTransform: "none",
                        py: 1.2, px: 2, borderRadius: 2,
                      }}
                    >
                      <Box sx={{ flex: 1, textAlign: "left" }}>
                        <Typography variant="body2" fontWeight={600}>{t.nombre_accion}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.etapa_destino
                            ? `→ ${t.etapa_destino.nombre}`
                            : t.devuelve_al_pool ? "→ Devolver al pool" : ""}
                        </Typography>
                      </Box>
                      {t.etapa_destino && (
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: t.etapa_destino.color, ml: 1, flexShrink: 0 }} />
                      )}
                    </Button>
                  ))}
                </Stack>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setTd(DIALOG_INIT)}>Cancelar</Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Typography variant="h6" fontWeight={700}>{td.selected?.nombre_accion}</Typography>
              {td.selected?.etapa_destino && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Pasará a:</Typography>
                  <Chip
                    label={td.selected.etapa_destino.nombre}
                    size="small"
                    sx={{ bgcolor: td.selected.etapa_destino.color, color: "white", fontWeight: 600 }}
                  />
                </Box>
              )}
            </DialogTitle>
            <DialogContent>
              <FormControl fullWidth margin="dense" size="small">
                <InputLabel>Canal de contacto</InputLabel>
                <Select value={td.canal} label="Canal de contacto"
                  onChange={(e) => setTd((p) => ({ ...p, canal: e.target.value }))}>
                  <MenuItem value="">Sin canal</MenuItem>
                  <MenuItem value="LLAMADA">📞 Llamada</MenuItem>
                  <MenuItem value="WHATSAPP">💬 WhatsApp</MenuItem>
                  <MenuItem value="SMS">📱 SMS</MenuItem>
                </Select>
              </FormControl>
              {td.selected?.requiere_nota && (
                <TextField
                  fullWidth label="Nota (requerida)" multiline rows={3}
                  value={td.nota} onChange={(e) => setTd((p) => ({ ...p, nota: e.target.value }))}
                  margin="dense" required size="small"
                />
              )}
              {esVenta && (
                <TextField
                  fullWidth label="Número de operación"
                  value={td.numOp} onChange={(e) => setTd((p) => ({ ...p, numOp: e.target.value }))}
                  margin="dense" required size="small"
                />
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setTd((p) => ({ ...p, step: 1, selected: null }))}>Atrás</Button>
              <Button
                variant="contained"
                onClick={executeTransicion}
                disabled={confirmDisabled}
                color={td.selected?.devuelve_al_pool ? "error" : "primary"}
              >
                {td.saving ? <CircularProgress size={20} color="inherit" /> : "Confirmar"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
