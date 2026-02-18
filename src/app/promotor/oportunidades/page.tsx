"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Chip, CircularProgress, Alert, Stack,
  MenuItem, Select, FormControl, InputLabel, Switch,
  FormControlLabel, IconButton, Tooltip, Collapse, Button,
  Tabs, Tab, Card, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import FilterListIcon from "@mui/icons-material/FilterList";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PhoneIcon from "@mui/icons-material/Phone";

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
  requiere_supervisor: boolean;
  devuelve_al_pool: boolean;
  etapa_destino: { id: number; nombre: string; color: string; tipo: string } | null;
}

const TIPO_ORDER = ["INICIO", "SEGUIMIENTO", "SALIDA", "FINAL"];

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
  const [loading, setLoading] = useState(true);
  const [tabActivo, setTabActivo] = useState<string>("__todas__");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [showFiltros, setShowFiltros] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [td, setTd] = useState(DIALOG_INIT);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/oportunidades");
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFiltro = (key: keyof typeof FILTROS_VACIOS, value: string | boolean) =>
    setFiltros((p) => ({ ...p, [key]: value }));

  // Etapas únicas ordenadas por posición en el embudo
  const etapasOrdenadas = useMemo(() => {
    const map = new Map<string, { nombre: string; tipo: string; color: string; count: number }>();
    rows.forEach((r) => {
      if (!r.etapa) return;
      const e = map.get(r.etapa.nombre);
      if (!e) map.set(r.etapa.nombre, { ...r.etapa, count: 1 });
      else e.count++;
    });
    return Array.from(map.values()).sort(
      (a, b) => TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo) || a.nombre.localeCompare(b.nombre)
    );
  }, [rows]);

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
    if (tabActivo !== "__todas__" && r.etapa?.nombre !== tabActivo) return false;
    if (filtros.tipoCliente && r.tipo_cliente !== filtros.tipoCliente) return false;
    if (filtros.convenio && r.convenio !== filtros.convenio) return false;
    if (filtros.estado && r.estado !== filtros.estado) return false;
    if (filtros.municipio && r.municipio !== filtros.municipio) return false;
    if (filtros.soloConTel && !r.tel_1) return false;
    return true;
  }), [rows, tabActivo, filtros]);

  const hayFiltros = Object.values(filtros).some((v) => v !== "" && v !== false);

  // — Transición: abrir dialog —
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
      setSnackbar({ open: true, message: err.error || "Error al ejecutar", severity: "error" });
    }
  };

  const esVenta = td.selected?.etapa_destino?.tipo === "FINAL" && td.selected?.etapa_destino?.nombre === "Venta";
  const confirmDisabled = td.saving
    || (!!td.selected?.requiere_nota && !td.nota.trim())
    || (esVenta && !td.numOp.trim());

  const columns: GridColDef[] = [
    {
      field: "nombres", headerName: "Cliente", flex: 1.5, minWidth: 160,
      renderCell: (p) => (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <Typography variant="body2" fontWeight={500} noWrap>{p.value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{p.row.tipo_cliente}</Typography>
        </Box>
      ),
    },
    {
      field: "convenio", headerName: "Convenio", flex: 1, minWidth: 130,
      renderCell: (p) => (
        <Typography variant="body2" noWrap sx={{ alignSelf: "center" }}>{p.value}</Typography>
      ),
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
        : <Typography variant="body2" color="text.disabled" sx={{ alignSelf: "center" }}>Sin teléfono</Typography>,
    },
    {
      field: "etapa", headerName: "Etapa", width: 155, sortable: false,
      renderCell: (p) => {
        const etapa = p.row.etapa;
        if (!etapa) return <Chip label="Sin etapa" size="small" />;
        return (
          <Tooltip title="Clic para cambiar etapa" placement="top">
            <Chip
              label={etapa.nombre}
              size="small"
              onClick={(e) => { e.stopPropagation(); openTransDialog(p.row.id); }}
              sx={{
                bgcolor: etapa.color,
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                alignSelf: "center",
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
          sx={{ minWidth: 0, px: 1.5, py: 0.5, fontSize: 12, alignSelf: "center" }}
        >
          Ver
        </Button>
      ),
    },
  ];

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box>
          <Typography variant="h4">Mis Oportunidades</Typography>
          <Typography variant="body2" color="text.secondary">
            {rows.length} oportunidades activas
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {hayFiltros && (
            <Button size="small" onClick={() => setFiltros(FILTROS_VACIOS)} startIcon={<FilterListOffIcon />}>
              Limpiar filtros
            </Button>
          )}
          <Tooltip title="Filtros adicionales">
            <IconButton onClick={() => setShowFiltros((p) => !p)} color={showFiltros ? "primary" : "default"}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {rows.length === 0 ? (
        <Alert severity="info">
          No tienes oportunidades activas. Solicita una asignación desde el Dashboard.
        </Alert>
      ) : (
        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>

          {/* Filtros adicionales (colapsables) */}
          <Collapse in={showFiltros}>
            <Box sx={{
              display: "flex", flexWrap: "wrap", gap: 1.5, p: 2,
              bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider",
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

          {/* Tabs del embudo */}
          <Box sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <Tabs
              value={tabActivo}
              onChange={(_, v) => setTabActivo(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: 2, minHeight: 48 }}
            >
              <Tab
                value="__todas__"
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <span>Todas</span>
                    <Chip
                      label={rows.length}
                      size="small"
                      sx={{ height: 18, minWidth: 24, fontSize: 11, bgcolor: "grey.200", color: "text.primary" }}
                    />
                  </Box>
                }
                sx={{ minHeight: 48, textTransform: "none", fontSize: 14 }}
              />
              {etapasOrdenadas.map((e) => (
                <Tab
                  key={e.nombre}
                  value={e.nombre}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <span>{e.nombre}</span>
                      <Chip
                        label={e.count}
                        size="small"
                        sx={{ height: 18, minWidth: 24, fontSize: 11, bgcolor: e.color, color: "white" }}
                      />
                    </Box>
                  }
                  sx={{ minHeight: 48, textTransform: "none", fontSize: 14 }}
                />
              ))}
            </Tabs>
          </Box>

          {/* Contenido de la tab activa */}
          {filtered.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <Typography variant="body1">Sin oportunidades en esta etapa</Typography>
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
                  bgcolor: "grey.50",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
                "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
                "& .MuiDataGrid-cell": {
                  borderColor: "grey.100",
                  display: "flex",
                  alignItems: "center",
                },
                "& .MuiDataGrid-footerContainer": { borderColor: "grey.100" },
                "& .MuiDataGrid-columnSeparator": { color: "grey.200" },
              }}
            />
          )}
        </Card>
      )}

      {/* Dialog: cambiar etapa */}
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
                        justifyContent: "flex-start",
                        textTransform: "none",
                        py: 1.2,
                        px: 2,
                        borderRadius: 2,
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
