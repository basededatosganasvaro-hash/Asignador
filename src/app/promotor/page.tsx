"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Grid, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Snackbar, Divider, FormControl, InputLabel,
  Select, MenuItem, Switch, FormControlLabel, Chip,
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

interface Opciones {
  tiposCliente: string[];
  convenios: string[];
  estados: string[];
  municipios: string[];
}

interface Disponibles {
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

export default function PromotorDashboard() {
  const { data: session } = useSession();
  const router = useRouter();

  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filtros del dialog
  const [filtros, setFiltros] = useState(FILTROS_INIT);
  const [opciones, setOpciones] = useState<Opciones>({ tiposCliente: [], convenios: [], estados: [], municipios: [] });
  const [disponibles, setDisponibles] = useState<Disponibles | null>(null);
  const [loadingOpciones, setLoadingOpciones] = useState(false);
  const [loadingCount, setLoadingCount] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchLotes = useCallback(async () => {
    const res = await fetch("/api/asignaciones");
    setLotes(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchLotes(); }, [fetchLotes]);

  // Abrir dialog: cargar opciones base
  const openDialog = async () => {
    setFiltros(FILTROS_INIT);
    setDisponibles(null);
    setDialogOpen(true);
    setLoadingOpciones(true);
    const res = await fetch("/api/asignaciones/opciones");
    setOpciones(await res.json());
    setLoadingOpciones(false);
    fetchCount(FILTROS_INIT);
  };

  // Cargar municipios cuando cambia estado
  const handleEstadoChange = async (estado: string) => {
    const next = { ...filtros, estado, municipio: "" };
    setFiltros(next);
    if (estado) {
      const res = await fetch(`/api/asignaciones/opciones?estado=${encodeURIComponent(estado)}`);
      const data = await res.json();
      setOpciones((p) => ({ ...p, municipios: data.municipios }));
    } else {
      setOpciones((p) => ({ ...p, municipios: [] }));
    }
    fetchCount(next);
  };

  const setFiltro = (key: keyof typeof FILTROS_INIT, value: string | boolean) => {
    const next = { ...filtros, [key]: value };
    setFiltros(next);
    fetchCount(next);
  };

  const fetchCount = useCallback(async (f: typeof FILTROS_INIT) => {
    setLoadingCount(true);
    const params = new URLSearchParams();
    if (f.tipo_cliente) params.set("tipo_cliente", f.tipo_cliente);
    if (f.convenio) params.set("convenio", f.convenio);
    if (f.estado) params.set("estado", f.estado);
    if (f.municipio) params.set("municipio", f.municipio);
    if (f.tiene_telefono) params.set("tiene_telefono", "1");
    const res = await fetch(`/api/asignaciones/disponibles?${params}`);
    setDisponibles(await res.json());
    setLoadingCount(false);
  }, []);

  const handleSolicitar = async () => {
    setRequesting(true);
    const res = await fetch("/api/asignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_cliente: filtros.tipo_cliente || undefined,
        convenio: filtros.convenio || undefined,
        estado: filtros.estado || undefined,
        municipio: filtros.municipio || undefined,
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

  const opActivas = lotes.reduce((s, l) => s + l.oportunidades_activas, 0);
  const totalRegistros = lotes.reduce((s, l) => s + l.cantidad, 0);
  const pendientes = lotes.filter((l) => !l.puede_descargar && l.oportunidades_activas > 0).length;

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
        <Button
          variant="contained"
          size="large"
          startIcon={<AddIcon />}
          onClick={openDialog}
          sx={{ py: 1.5, px: 4 }}
        >
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

      {/* Dialog de solicitud con filtros */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Solicitar Asignación</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>

          {/* Contador de disponibles */}
          <Box
            sx={{
              textAlign: "center", py: 2.5, mb: 2,
              bgcolor: "primary.50", borderRadius: 2,
              border: "1px solid", borderColor: "primary.200",
            }}
          >
            {loadingCount || loadingOpciones ? (
              <CircularProgress size={32} />
            ) : (
              <>
                <Typography variant="h3" fontWeight={700} color="primary.main">
                  {disponibles?.asignables?.toLocaleString() ?? "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  registros disponibles con estos filtros
                </Typography>
                {disponibles && (
                  <Box sx={{ mt: 1, display: "flex", justifyContent: "center", gap: 1 }}>
                    <Chip
                      size="small"
                      label={`Cupo del día: ${disponibles.cupoRestante}`}
                      color={disponibles.cupoRestante > 0 ? "success" : "error"}
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={`En pool: ${disponibles.disponibles.toLocaleString()}`}
                      variant="outlined"
                    />
                  </Box>
                )}
              </>
            )}
          </Box>

          <Divider sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">FILTROS</Typography>
          </Divider>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel shrink>Tipo de cliente</InputLabel>
              <Select
                value={filtros.tipo_cliente}
                label="Tipo de cliente"
                notched
                displayEmpty
                onChange={(e) => setFiltro("tipo_cliente", e.target.value)}
                disabled={loadingOpciones}
              >
                <MenuItem value=""><em>Todos</em></MenuItem>
                {opciones.tiposCliente.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel shrink>Convenio</InputLabel>
              <Select
                value={filtros.convenio}
                label="Convenio"
                notched
                displayEmpty
                onChange={(e) => setFiltro("convenio", e.target.value)}
                disabled={loadingOpciones}
              >
                <MenuItem value=""><em>Todos</em></MenuItem>
                {opciones.convenios.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>

            <Box sx={{ display: "flex", gap: 1.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel shrink>Estado</InputLabel>
                <Select
                  value={filtros.estado}
                  label="Estado"
                  notched
                  displayEmpty
                  onChange={(e) => handleEstadoChange(e.target.value)}
                  disabled={loadingOpciones}
                >
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  {opciones.estados.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel shrink>Municipio</InputLabel>
                <Select
                  value={filtros.municipio}
                  label="Municipio"
                  notched
                  displayEmpty
                  onChange={(e) => setFiltro("municipio", e.target.value)}
                  disabled={!filtros.estado || opciones.municipios.length === 0}
                >
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  {opciones.municipios.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={filtros.tiene_telefono}
                  onChange={(e) => setFiltro("tiene_telefono", e.target.checked)}
                  size="small"
                />
              }
              label="Solo registros con teléfono"
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSolicitar}
            disabled={requesting || loadingCount || (disponibles?.asignables ?? 0) === 0}
            startIcon={requesting ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {requesting ? "Solicitando..." : `Solicitar${disponibles?.asignables ? ` ${Math.min(disponibles.asignables, disponibles.cupoRestante).toLocaleString()}` : ""}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
