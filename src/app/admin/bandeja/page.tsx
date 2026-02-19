"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Tabs, Tab, Chip, Alert, Snackbar, IconButton,
  Button, Drawer, Stack, Card, CardContent, TextField, FormControl,
  InputLabel, Select, MenuItem, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, DialogContentText,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OportunidadBandeja {
  id: number;
  cliente_id: number;
  nombres: string;
  convenio: string;
  etapa: { id: number; nombre: string; color: string; tipo: string } | null;
  promotor: { id: number; nombre: string };
  timer_vence: string | null;
  updated_at: string;
}

interface OportunidadDetalle {
  id: number;
  cliente_id: number;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  activo: boolean;
  cliente: Record<string, string | null>;
  transiciones: {
    id: number;
    nombre_accion: string;
    requiere_nota: boolean;
    requiere_supervisor: boolean;
    devuelve_al_pool: boolean;
    etapa_destino: { id: number; nombre: string; color: string; tipo: string } | null;
  }[];
}

interface Promotor {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
  total_activas: number;
  en_salida: number;
  en_avance: number;
}

interface OportunidadEquipo extends OportunidadBandeja {}

// ─── Timer label ──────────────────────────────────────────────────────────────

function timerLabel(timer_vence: string | null) {
  if (!timer_vence) return "Sin timer";
  const diff = new Date(timer_vence).getTime() - Date.now();
  if (diff <= 0) return "Vencido";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BandejaPage() {
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const showSnack = (message: string, severity: "success" | "error" = "success") =>
    setSnackbar({ open: true, message, severity });

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Bandeja del Supervisor</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="En Salida" />
        <Tab label="Mi Equipo" />
        <Tab label="Promotores" />
      </Tabs>

      {tab === 0 && <BandejaTab showSnack={showSnack} />}
      {tab === 1 && <EquipoTab showSnack={showSnack} />}
      {tab === 2 && <PromotoresTab showSnack={showSnack} />}

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

// ─── Tab 1: Bandeja SALIDA ────────────────────────────────────────────────────

function BandejaTab({ showSnack }: { showSnack: (m: string, s?: "success" | "error") => void }) {
  const [rows, setRows] = useState<OportunidadBandeja[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OportunidadDetalle | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nota, setNota] = useState("");
  const [canal, setCanal] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/bandeja");
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenDrawer = async (id: number) => {
    const res = await fetch(`/api/oportunidades/${id}`);
    if (res.ok) {
      setSelected(await res.json());
      setNota("");
      setCanal("");
      setDrawerOpen(true);
    }
  };

  const handleTransicion = async (transicionId: number, requiereNota: boolean) => {
    if (requiereNota && !nota.trim()) {
      showSnack("Esta transición requiere una nota", "error");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/oportunidades/${selected!.id}/transicion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transicion_id: transicionId, nota: nota || undefined, canal: canal || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      setDrawerOpen(false);
      showSnack("Acción ejecutada");
      fetchData();
    } else {
      const err = await res.json();
      showSnack(err.error || "Error", "error");
    }
  };

  const columns: GridColDef[] = [
    { field: "nombres", headerName: "Cliente", flex: 1.2 },
    { field: "convenio", headerName: "Convenio", flex: 1 },
    {
      field: "etapa", headerName: "Etapa", width: 150,
      renderCell: (p) => p.row.etapa
        ? <Chip label={p.row.etapa.nombre} size="small" sx={{ bgcolor: p.row.etapa.color, color: "white" }} />
        : "—",
    },
    { field: "promotor", headerName: "Promotor", width: 150, valueGetter: (_v: unknown, row: OportunidadBandeja) => row.promotor?.nombre ?? "—" },
    { field: "timer_vence", headerName: "Timer", width: 110, renderCell: (p) => <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}><AccessTimeIcon sx={{ fontSize: 14 }} /><Typography variant="body2">{timerLabel(p.row.timer_vence)}</Typography></Box> },
    {
      field: "actions", headerName: "Acciones", width: 90, sortable: false,
      renderCell: (p) => <IconButton size="small" onClick={() => handleOpenDrawer(p.row.id)} title="Ver y actuar"><VisibilityIcon fontSize="small" /></IconButton>,
    },
  ];

  return (
    <>
      {rows.length === 0 && !loading && <Alert severity="info">No hay oportunidades en etapas de salida.</Alert>}
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[25]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: 420, p: 3 } }}>
        {selected && (
          <Stack spacing={2}>
            <Typography variant="h6">Oportunidad #{selected.id}</Typography>
            {selected.etapa && <Chip label={selected.etapa.nombre} sx={{ bgcolor: selected.etapa.color, color: "white", fontWeight: 700, alignSelf: "flex-start" }} />}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Datos del cliente</Typography>
                <Typography>{(selected.cliente as { nombres?: string }).nombres ?? "—"}</Typography>
                <Typography variant="body2" color="text.secondary">{(selected.cliente as { convenio?: string }).convenio ?? "—"}</Typography>
              </CardContent>
            </Card>

            <FormControl fullWidth size="small">
              <InputLabel>Canal</InputLabel>
              <Select value={canal} label="Canal" onChange={(e) => setCanal(e.target.value)}>
                <MenuItem value="">Sin canal</MenuItem>
                <MenuItem value="LLAMADA">📞 Llamada</MenuItem>
                <MenuItem value="WHATSAPP">💬 WhatsApp</MenuItem>
                <MenuItem value="SMS">📱 SMS</MenuItem>
              </Select>
            </FormControl>

            <TextField label="Nota" multiline rows={3} value={nota} onChange={(e) => setNota(e.target.value)} size="small" />

            <Typography variant="subtitle2">Acciones disponibles</Typography>
            {selected.transiciones.length === 0 && <Alert severity="info">Sin acciones disponibles.</Alert>}
            <Stack spacing={1}>
              {selected.transiciones.map((t) => (
                <Button
                  key={t.id}
                  variant="outlined"
                  fullWidth
                  disabled={saving}
                  onClick={() => handleTransicion(t.id, t.requiere_nota)}
                  color={t.devuelve_al_pool ? "error" : t.etapa_destino?.tipo === "AVANCE" ? "success" : "primary"}
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  {t.nombre_accion}
                  {t.etapa_destino && <Chip label={t.etapa_destino.nombre} size="small" sx={{ ml: "auto", bgcolor: t.etapa_destino.color, color: "white" }} />}
                  {t.devuelve_al_pool && <Chip label="Pool" size="small" sx={{ ml: "auto" }} />}
                </Button>
              ))}
            </Stack>
          </Stack>
        )}
      </Drawer>
    </>
  );
}

// ─── Tab 2: Mi Equipo (todas las oportunidades) ───────────────────────────────

function EquipoTab({ showSnack }: { showSnack: (m: string, s?: "success" | "error") => void }) {
  const [rows, setRows] = useState<OportunidadEquipo[]>([]);
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasignarOp, setReasignarOp] = useState<OportunidadEquipo | null>(null);
  const [nuevoPromotor, setNuevoPromotor] = useState("");

  const fetchData = useCallback(async () => {
    const [opRes, prRes] = await Promise.all([
      fetch("/api/admin/equipo/oportunidades"),
      fetch("/api/admin/equipo"),
    ]);
    setRows(await opRes.json());
    setPromotores(await prRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReasignar = async () => {
    if (!reasignarOp || !nuevoPromotor) return;
    const res = await fetch(`/api/admin/oportunidades/${reasignarOp.id}/reasignar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nuevo_usuario_id: Number(nuevoPromotor) }),
    });
    if (res.ok) {
      setReasignarOp(null);
      setNuevoPromotor("");
      showSnack("Oportunidad reasignada");
      fetchData();
    } else {
      const err = await res.json();
      showSnack(err.error || "Error", "error");
    }
  };

  const columns: GridColDef[] = [
    { field: "nombres", headerName: "Cliente", flex: 1.2 },
    { field: "convenio", headerName: "Convenio", flex: 1 },
    {
      field: "etapa", headerName: "Etapa", width: 140,
      renderCell: (p) => p.row.etapa
        ? <Chip label={p.row.etapa.nombre} size="small" sx={{ bgcolor: p.row.etapa.color, color: "white" }} />
        : "—",
    },
    { field: "promotor", headerName: "Promotor", width: 140, valueGetter: (_v: unknown, row: OportunidadEquipo) => row.promotor?.nombre ?? "—" },
    { field: "timer_vence", headerName: "Timer", width: 110, renderCell: (p) => <Typography variant="body2" color="text.secondary">{timerLabel(p.row.timer_vence)}</Typography> },
    {
      field: "actions", headerName: "Acciones", width: 100, sortable: false,
      renderCell: (p) => <IconButton size="small" onClick={() => { setReasignarOp(p.row); setNuevoPromotor(""); }} title="Reasignar"><SwapHorizIcon fontSize="small" /></IconButton>,
    },
  ];

  return (
    <>
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>

      <Dialog open={!!reasignarOp} onClose={() => setReasignarOp(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reasignar Oportunidad</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Cliente: <strong>{reasignarOp?.nombres}</strong>
          </DialogContentText>
          <FormControl fullWidth>
            <InputLabel>Nuevo promotor</InputLabel>
            <Select value={nuevoPromotor} label="Nuevo promotor" onChange={(e) => setNuevoPromotor(e.target.value)}>
              {promotores.filter((p) => p.id !== reasignarOp?.promotor?.id).map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>{p.nombre} ({p.total_activas} activas)</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReasignarOp(null)} color="error" variant="outlined">Cancelar</Button>
          <Button variant="contained" onClick={handleReasignar} disabled={!nuevoPromotor}>Reasignar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── Tab 3: Promotores ────────────────────────────────────────────────────────

function PromotoresTab({ showSnack }: { showSnack: (m: string, s?: "success" | "error") => void }) {
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [loading, setLoading] = useState(true);
  const [bajaPromotor, setBajaPromotor] = useState<Promotor | null>(null);
  const [receptorId, setReceptorId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/equipo");
    setPromotores(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBaja = async () => {
    if (!bajaPromotor) return;
    setSaving(true);
    const res = await fetch(`/api/admin/usuarios/${bajaPromotor.id}/baja`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receptor_id: receptorId ? Number(receptorId) : undefined }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setBajaPromotor(null);
      showSnack(`Promotor dado de baja. ${data.transferidas} oportunidades transferidas.`);
      fetchData();
    } else {
      const err = await res.json();
      showSnack(err.error || "Error", "error");
    }
  };

  const columns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "total_activas", headerName: "Activas", width: 90, align: "center", headerAlign: "center" },
    { field: "en_salida", headerName: "En Salida", width: 100, align: "center", headerAlign: "center", renderCell: (p) => p.value > 0 ? <Chip label={p.value} size="small" color="warning" /> : p.value },
    { field: "en_avance", headerName: "En Avance", width: 100, align: "center", headerAlign: "center" },
    {
      field: "actions", headerName: "Acciones", width: 130, sortable: false,
      renderCell: (p) => (
        <Button size="small" color="error" startIcon={<PersonOffIcon />} onClick={() => { setBajaPromotor(p.row); setReceptorId(""); }}>
          Dar de baja
        </Button>
      ),
    },
  ];

  return (
    <>
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid rows={promotores} columns={columns} loading={loading} pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>

      <Dialog open={!!bajaPromotor} onClose={() => setBajaPromotor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Dar de Baja: {bajaPromotor?.nombre}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Este promotor tiene <strong>{bajaPromotor?.total_activas}</strong> oportunidades activas. Se transferirán al promotor seleccionado (o a ti si no seleccionas ninguno).
          </DialogContentText>
          <FormControl fullWidth>
            <InputLabel>Transferir oportunidades a (opcional)</InputLabel>
            <Select value={receptorId} label="Transferir oportunidades a (opcional)" onChange={(e) => setReceptorId(e.target.value)}>
              <MenuItem value="">A mí mismo</MenuItem>
              {promotores.filter((p) => p.id !== bajaPromotor?.id).map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBajaPromotor(null)} color="error" variant="outlined">Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleBaja} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "Confirmar baja"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
