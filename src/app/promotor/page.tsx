"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Grid, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Snackbar, Divider, FormControl, InputLabel,
  Select, MenuItem, Switch, FormControlLabel, Chip, TextField, Slider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PhoneIcon from "@mui/icons-material/Phone";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import StatCard from "@/components/ui/StatCard";

interface Lote {
  id: number;
  fecha: string;
  cantidad: number;
  oportunidades_activas: number;
  registros_con_tel1: number;
  puede_descargar: boolean;
}

interface OpcionesResp {
  tiposCliente: string[];
  convenios: string[];
  estados: string[];
  municipios: string[];
  disponibles: number;
  cupoRestante: number;
  asignables: number;
}

const FILTROS_INIT = {
  tipo_cliente: "",
  convenio: "",
  estado: "",
  municipio: "",
  tiene_telefono: false,
};

const OPCIONES_INIT: OpcionesResp = {
  tiposCliente: [], convenios: [], estados: [], municipios: [],
  disponibles: 0, cupoRestante: 0, asignables: 0,
};

export default function PromotorDashboard() {
  const { data: session } = useSession();
  const router = useRouter();

  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [filtros, setFiltros] = useState(FILTROS_INIT);
  const [opciones, setOpciones] = useState<OpcionesResp>(OPCIONES_INIT);
  const [cantidad, setCantidad] = useState<number>(0);
  const [loadingOpciones, setLoadingOpciones] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [snackbar, setSnackbar] = useState({
    open: false, message: "", severity: "success" as "success" | "error",
  });

  const fetchLotes = useCallback(async () => {
    const res = await fetch("/api/asignaciones");
    setLotes(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchLotes(); }, [fetchLotes]);

  // Llama al API con los filtros actuales y cancela la llamada anterior
  const fetchOpciones = useCallback(async (f: typeof FILTROS_INIT) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoadingOpciones(true);

    const params = new URLSearchParams();
    if (f.tipo_cliente)   params.set("tipo_cliente",   f.tipo_cliente);
    if (f.convenio)       params.set("convenio",       f.convenio);
    if (f.estado)         params.set("estado",         f.estado);
    if (f.municipio)      params.set("municipio",      f.municipio);
    if (f.tiene_telefono) params.set("tiene_telefono", "1");

    try {
      const res = await fetch(`/api/asignaciones/opciones?${params}`, {
        signal: abortRef.current.signal,
      });
      const data: OpcionesResp = await res.json();
      setOpciones(data);
      // Sincroniza cantidad al nuevo máximo (o mantiene el valor si ya es menor)
      setCantidad((prev) => prev > 0 ? Math.min(prev, data.asignables) : data.asignables);
    } catch {
      // ignorar AbortError
    } finally {
      setLoadingOpciones(false);
    }
  }, []);

  const openDialog = () => {
    const f = FILTROS_INIT;
    setFiltros(f);
    setOpciones(OPCIONES_INIT);
    setCantidad(0);
    setDialogOpen(true);
    fetchOpciones(f);
  };

  // Cambia un filtro, resetea los downstream y recarga
  const cambiar = (key: keyof typeof FILTROS_INIT, value: string | boolean) => {
    setFiltros((prev) => {
      const next = { ...prev, [key]: value };
      // Reset downstream en cascada
      if (key === "tipo_cliente") { next.convenio = ""; next.estado = ""; next.municipio = ""; }
      if (key === "convenio")     { next.estado = ""; next.municipio = ""; }
      if (key === "estado")       { next.municipio = ""; }
      fetchOpciones(next);
      return next;
    });
  };

  const handleSolicitar = async () => {
    setRequesting(true);
    const res = await fetch("/api/asignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cantidad:       cantidad > 0 ? cantidad : undefined,
        tipo_cliente:   filtros.tipo_cliente   || undefined,
        convenio:       filtros.convenio       || undefined,
        estado:         filtros.estado         || undefined,
        municipio:      filtros.municipio      || undefined,
        tiene_telefono: filtros.tiene_telefono || undefined,
      }),
    });
    setRequesting(false);
    setDialogOpen(false);

    if (res.ok) {
      const data = await res.json();
      setSnackbar({ open: true, message: `Asignación creada con ${data.cantidad} registros`, severity: "success" });
      fetchLotes();
      router.push(`/promotor/asignaciones/${data.id}`);
    } else {
      const data = await res.json();
      setSnackbar({ open: true, message: data.error || "Error al solicitar asignación", severity: "error" });
    }
  };

  const opActivas    = lotes.reduce((s, l) => s + l.oportunidades_activas, 0);
  const totalRegistros = lotes.reduce((s, l) => s + l.cantidad, 0);
  const pendientes   = lotes.filter((l) => !l.puede_descargar && l.oportunidades_activas > 0).length;

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4">
            Bienvenido, {session?.user?.nombre || session?.user?.name}
          </Typography>
          <Typography variant="body1" color="text.secondary">Panel de promotor</Typography>
        </Box>
        <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={openDialog} sx={{ py: 1.5, px: 4 }}>
          Solicitar Asignación
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <StatCard title="Total Lotes" value={lotes.length} icon={<AssignmentIcon />} color="#1565c0" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <StatCard title="Total Registros" value={totalRegistros.toLocaleString()} icon={<PeopleAltIcon />} color="#1565c0" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <StatCard title="Oportunidades Activas" value={opActivas.toLocaleString()} icon={<PhoneIcon />} color="#2e7d32" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <StatCard title="Pendientes de datos" value={pendientes} icon={<PendingActionsIcon />} color="#ed6c02" />
        </Grid>
      </Grid>

      {/* Dialog con filtros en cascada */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Solicitar Asignación</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>

          {/* Contador */}
          <Box sx={{
            textAlign: "center", py: 2.5, mb: 2,
            bgcolor: "primary.50", borderRadius: 2,
            border: "1px solid", borderColor: "primary.200",
            minHeight: 96, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            {loadingOpciones ? (
              <CircularProgress size={32} />
            ) : (
              <>
                <Typography variant="h3" fontWeight={700} color="primary.main">
                  {opciones.asignables.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  registros disponibles con estos filtros
                </Typography>
                <Box sx={{ mt: 1, display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap" }}>
                  <Chip
                    size="small"
                    label={`Cupo del día: ${opciones.cupoRestante}`}
                    color={opciones.cupoRestante > 0 ? "success" : "error"}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={`En pool: ${opciones.disponibles.toLocaleString()}`}
                    variant="outlined"
                  />
                </Box>
              </>
            )}
          </Box>

          <Divider sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">FILTROS</Typography>
          </Divider>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

            {/* Tipo de cliente — independiente */}
            <FormControl fullWidth size="small">
              <InputLabel shrink>Tipo de cliente</InputLabel>
              <Select value={filtros.tipo_cliente} label="Tipo de cliente" notched displayEmpty
                onChange={(e) => cambiar("tipo_cliente", e.target.value)}>
                <MenuItem value=""><em>Todos ({opciones.tiposCliente.length} tipos)</em></MenuItem>
                {opciones.tiposCliente.map((v) => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Convenio — depende de tipo_cliente */}
            <FormControl fullWidth size="small" disabled={opciones.convenios.length === 0 && !filtros.convenio}>
              <InputLabel shrink>Convenio</InputLabel>
              <Select value={filtros.convenio} label="Convenio" notched displayEmpty
                onChange={(e) => cambiar("convenio", e.target.value)}>
                <MenuItem value="">
                  <em>
                    {opciones.convenios.length > 0
                      ? `Todos (${opciones.convenios.length} convenios)`
                      : filtros.tipo_cliente ? "Sin convenios disponibles" : "Todos"}
                  </em>
                </MenuItem>
                {opciones.convenios.map((v) => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Estado + Municipio */}
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <FormControl fullWidth size="small" disabled={opciones.estados.length === 0 && !filtros.estado}>
                <InputLabel shrink>Estado</InputLabel>
                <Select value={filtros.estado} label="Estado" notched displayEmpty
                  onChange={(e) => cambiar("estado", e.target.value)}>
                  <MenuItem value="">
                    <em>
                      {opciones.estados.length > 0
                        ? `Todos (${opciones.estados.length})`
                        : "Sin estados"}
                    </em>
                  </MenuItem>
                  {opciones.estados.map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" disabled={!filtros.estado || opciones.municipios.length === 0}>
                <InputLabel shrink>Municipio</InputLabel>
                <Select value={filtros.municipio} label="Municipio" notched displayEmpty
                  onChange={(e) => cambiar("municipio", e.target.value)}>
                  <MenuItem value="">
                    <em>
                      {!filtros.estado ? "Selecciona estado" :
                        opciones.municipios.length > 0
                          ? `Todos (${opciones.municipios.length})`
                          : "Sin municipios"}
                    </em>
                  </MenuItem>
                  {opciones.municipios.map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={filtros.tiene_telefono}
                  onChange={(e) => cambiar("tiene_telefono", e.target.checked)}
                  size="small"
                />
              }
              label="Solo registros con teléfono"
            />

            {/* Selector de cantidad */}
            {opciones.asignables > 0 && !loadingOpciones && (
              <>
                <Divider sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">CANTIDAD</Typography>
                </Divider>
                <Box sx={{ px: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 0.5 }}>
                    <Slider
                      value={cantidad}
                      min={1}
                      max={opciones.asignables}
                      step={1}
                      onChange={(_, v) => setCantidad(v as number)}
                      sx={{ flex: 1 }}
                      size="small"
                    />
                    <TextField
                      type="number"
                      value={cantidad}
                      size="small"
                      sx={{ width: 90 }}
                      inputProps={{ min: 1, max: opciones.asignables }}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(opciones.asignables, Number(e.target.value)));
                        setCantidad(isNaN(v) ? 1 : v);
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Máximo disponible: {opciones.asignables.toLocaleString()} · Cupo restante hoy: {opciones.cupoRestante.toLocaleString()}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSolicitar}
            disabled={requesting || loadingOpciones || cantidad === 0}
            startIcon={requesting ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {requesting
              ? "Solicitando..."
              : cantidad > 0
                ? `Solicitar ${cantidad.toLocaleString()} registros`
                : "Sin disponibles"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
