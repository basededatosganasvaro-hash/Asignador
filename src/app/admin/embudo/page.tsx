"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, Alert, Snackbar, IconButton, FormControl, InputLabel,
  Select, MenuItem, Checkbox, FormControlLabel, Divider,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Etapa {
  id: number;
  nombre: string;
  orden: number;
  tipo: string;
  timer_horas: number | null;
  color: string;
  activo: boolean;
}

interface Transicion {
  id: number;
  nombre_accion: string;
  requiere_nota: boolean;
  requiere_supervisor: boolean;
  devuelve_al_pool: boolean;
  activo: boolean;
  etapa_origen: { id: number; nombre: string; color: string };
  etapa_destino: { id: number; nombre: string; color: string } | null;
}

const TIPO_COLORS: Record<string, "primary" | "warning" | "error" | "success" | "default"> = {
  AVANCE: "primary",
  SALIDA: "warning",
  FINAL: "success",
};

export default function EmbudoPage() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [transiciones, setTransiciones] = useState<Transicion[]>([]);
  const [loadingE, setLoadingE] = useState(true);
  const [loadingT, setLoadingT] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // Dialog Etapa
  const [etapaDialogOpen, setEtapaDialogOpen] = useState(false);
  const [editingEtapa, setEditingEtapa] = useState<Etapa | null>(null);
  const [etapaForm, setEtapaForm] = useState({ nombre: "", orden: "", tipo: "AVANCE", timer_horas: "", color: "#1565c0" });

  // Dialog Transicion
  const [transDialogOpen, setTransDialogOpen] = useState(false);
  const [transForm, setTransForm] = useState({
    etapa_origen_id: "", etapa_destino_id: "", nombre_accion: "",
    requiere_nota: true, requiere_supervisor: false, devuelve_al_pool: false,
  });

  const fetchEtapas = useCallback(async () => {
    const res = await fetch("/api/admin/embudo/etapas");
    setEtapas(await res.json());
    setLoadingE(false);
  }, []);

  const fetchTransiciones = useCallback(async () => {
    const res = await fetch("/api/admin/embudo/transiciones");
    setTransiciones(await res.json());
    setLoadingT(false);
  }, []);

  useEffect(() => { fetchEtapas(); fetchTransiciones(); }, [fetchEtapas, fetchTransiciones]);

  const handleSaveEtapa = async () => {
    const url = editingEtapa ? `/api/admin/embudo/etapas/${editingEtapa.id}` : "/api/admin/embudo/etapas";
    const method = editingEtapa ? "PUT" : "POST";
    const body = {
      nombre: etapaForm.nombre, orden: Number(etapaForm.orden), tipo: etapaForm.tipo,
      timer_horas: etapaForm.timer_horas ? Number(etapaForm.timer_horas) : null, color: etapaForm.color,
    };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setEtapaDialogOpen(false);
      setSnackbar({ open: true, message: editingEtapa ? "Etapa actualizada" : "Etapa creada", severity: "success" });
      fetchEtapas();
    } else {
      const data = await res.json();
      setSnackbar({ open: true, message: data.error || "Error", severity: "error" });
    }
  };

  const handleToggleEtapa = async (etapa: Etapa) => {
    const res = await fetch(`/api/admin/embudo/etapas/${etapa.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !etapa.activo }),
    });
    if (res.ok) { setSnackbar({ open: true, message: etapa.activo ? "Desactivada" : "Activada", severity: "success" }); fetchEtapas(); }
  };

  const handleSaveTransicion = async () => {
    const body = {
      etapa_origen_id: Number(transForm.etapa_origen_id),
      etapa_destino_id: transForm.devuelve_al_pool ? null : (transForm.etapa_destino_id ? Number(transForm.etapa_destino_id) : null),
      nombre_accion: transForm.nombre_accion,
      requiere_nota: transForm.requiere_nota,
      requiere_supervisor: transForm.requiere_supervisor,
      devuelve_al_pool: transForm.devuelve_al_pool,
    };
    const res = await fetch("/api/admin/embudo/transiciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setTransDialogOpen(false);
      setTransForm({ etapa_origen_id: "", etapa_destino_id: "", nombre_accion: "", requiere_nota: true, requiere_supervisor: false, devuelve_al_pool: false });
      setSnackbar({ open: true, message: "Transicion creada", severity: "success" });
      fetchTransiciones();
    } else {
      const data = await res.json();
      setSnackbar({ open: true, message: data.error || "Error", severity: "error" });
    }
  };

  const handleToggleTransicion = async (t: Transicion) => {
    const res = await fetch(`/api/admin/embudo/transiciones/${t.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !t.activo }),
    });
    if (res.ok) { setSnackbar({ open: true, message: t.activo ? "Desactivada" : "Activada", severity: "success" }); fetchTransiciones(); }
  };

  const etapaColumns: GridColDef[] = [
    { field: "orden", headerName: "#", width: 60, align: "center", headerAlign: "center" },
    {
      field: "nombre", headerName: "Nombre", flex: 1,
      renderCell: (p) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: p.row.color, flexShrink: 0 }} />
          {p.value}
        </Box>
      ),
    },
    { field: "tipo", headerName: "Tipo", width: 100, renderCell: (p) => <Chip label={p.value} color={TIPO_COLORS[p.value] ?? "default"} size="small" /> },
    { field: "timer_horas", headerName: "Timer (h)", width: 100, align: "center", headerAlign: "center", valueGetter: (_v: unknown, row: Etapa) => row.timer_horas ?? "—" },
    { field: "activo", headerName: "Estado", width: 90, renderCell: (p) => <Chip label={p.value ? "Activo" : "Inactivo"} color={p.value ? "success" : "default"} size="small" /> },
    {
      field: "actions", headerName: "Acciones", width: 110, sortable: false,
      renderCell: (p) => (
        <Box>
          <IconButton size="small" onClick={() => { setEditingEtapa(p.row); setEtapaForm({ nombre: p.row.nombre, orden: String(p.row.orden), tipo: p.row.tipo, timer_horas: p.row.timer_horas ? String(p.row.timer_horas) : "", color: p.row.color }); setEtapaDialogOpen(true); }}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => handleToggleEtapa(p.row)} color={p.row.activo ? "error" : "success"}>
            {p.row.activo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
          </IconButton>
        </Box>
      ),
    },
  ];

  const transColumns: GridColDef[] = [
    {
      field: "etapa_origen", headerName: "Desde", flex: 1,
      renderCell: (p) => <Chip label={p.row.etapa_origen?.nombre ?? "—"} size="small" sx={{ bgcolor: p.row.etapa_origen?.color, color: "white" }} />,
    },
    {
      field: "etapa_destino", headerName: "Hacia", flex: 1,
      renderCell: (p) => p.row.devuelve_al_pool
        ? <Chip label="Pool" size="small" color="default" />
        : <Chip label={p.row.etapa_destino?.nombre ?? "—"} size="small" sx={{ bgcolor: p.row.etapa_destino?.color, color: "white" }} />,
    },
    { field: "nombre_accion", headerName: "Acción", flex: 1 },
    { field: "requiere_nota", headerName: "Nota", width: 70, align: "center", headerAlign: "center", renderCell: (p) => p.value ? "✓" : "—" },
    { field: "requiere_supervisor", headerName: "Sup.", width: 70, align: "center", headerAlign: "center", renderCell: (p) => p.value ? "✓" : "—" },
    { field: "activo", headerName: "Estado", width: 90, renderCell: (p) => <Chip label={p.value ? "Activo" : "Inactivo"} color={p.value ? "success" : "default"} size="small" /> },
    {
      field: "actions", headerName: "", width: 70, sortable: false,
      renderCell: (p) => (
        <IconButton size="small" onClick={() => handleToggleTransicion(p.row)} color={p.row.activo ? "error" : "success"}>
          {p.row.activo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Embudo de Ventas</Typography>

      {/* ETAPAS */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">Etapas</Typography>
        <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => { setEditingEtapa(null); setEtapaForm({ nombre: "", orden: "", tipo: "AVANCE", timer_horas: "", color: "#1565c0" }); setEtapaDialogOpen(true); }}>
          Nueva Etapa
        </Button>
      </Box>
      <Box sx={{ bgcolor: "white", borderRadius: 2, mb: 4 }}>
        <DataGrid rows={etapas} columns={etapaColumns} loading={loadingE} pageSizeOptions={[10]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* TRANSICIONES */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">Transiciones</Typography>
        <Button variant="outlined" startIcon={<AddIcon />} size="small" onClick={() => setTransDialogOpen(true)}>
          Nueva Transición
        </Button>
      </Box>
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid rows={transiciones} columns={transColumns} loading={loadingT} pageSizeOptions={[25]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>

      {/* Dialog Etapa */}
      <Dialog open={etapaDialogOpen} onClose={() => setEtapaDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingEtapa ? "Editar Etapa" : "Nueva Etapa"}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nombre" value={etapaForm.nombre} onChange={(e) => setEtapaForm({ ...etapaForm, nombre: e.target.value })} margin="normal" required />
          <TextField fullWidth label="Orden" type="number" value={etapaForm.orden} onChange={(e) => setEtapaForm({ ...etapaForm, orden: e.target.value })} margin="normal" required />
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo</InputLabel>
            <Select value={etapaForm.tipo} label="Tipo" onChange={(e) => setEtapaForm({ ...etapaForm, tipo: e.target.value })}>
              <MenuItem value="AVANCE">AVANCE</MenuItem>
              <MenuItem value="SALIDA">SALIDA</MenuItem>
              <MenuItem value="FINAL">FINAL</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth label="Timer (horas, opcional)" type="number" value={etapaForm.timer_horas} onChange={(e) => setEtapaForm({ ...etapaForm, timer_horas: e.target.value })} margin="normal" />
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
            <TextField label="Color (hex)" value={etapaForm.color} onChange={(e) => setEtapaForm({ ...etapaForm, color: e.target.value })} sx={{ flex: 1 }} />
            <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: etapaForm.color, border: "1px solid #ccc" }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEtapaDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveEtapa}>{editingEtapa ? "Actualizar" : "Crear"}</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Transicion */}
      <Dialog open={transDialogOpen} onClose={() => setTransDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nueva Transición</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Desde etapa</InputLabel>
            <Select value={transForm.etapa_origen_id} label="Desde etapa" onChange={(e) => setTransForm({ ...transForm, etapa_origen_id: e.target.value })}>
              {etapas.filter(e => e.activo).map((e) => <MenuItem key={e.id} value={String(e.id)}><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: e.color }} />{e.nombre}</Box></MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel control={<Checkbox checked={transForm.devuelve_al_pool} onChange={(e) => setTransForm({ ...transForm, devuelve_al_pool: e.target.checked, etapa_destino_id: "" })} />} label="Devuelve al pool" sx={{ mt: 1 }} />
          {!transForm.devuelve_al_pool && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Hacia etapa</InputLabel>
              <Select value={transForm.etapa_destino_id} label="Hacia etapa" onChange={(e) => setTransForm({ ...transForm, etapa_destino_id: e.target.value })}>
                {etapas.filter(e => e.activo).map((e) => <MenuItem key={e.id} value={String(e.id)}><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: e.color }} />{e.nombre}</Box></MenuItem>)}
              </Select>
            </FormControl>
          )}
          <TextField fullWidth label="Nombre de acción" value={transForm.nombre_accion} onChange={(e) => setTransForm({ ...transForm, nombre_accion: e.target.value })} margin="normal" required />
          <FormControlLabel control={<Checkbox checked={transForm.requiere_nota} onChange={(e) => setTransForm({ ...transForm, requiere_nota: e.target.checked })} />} label="Requiere nota" />
          <FormControlLabel control={<Checkbox checked={transForm.requiere_supervisor} onChange={(e) => setTransForm({ ...transForm, requiere_supervisor: e.target.checked })} />} label="Requiere supervisor" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTransDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveTransicion} disabled={!transForm.etapa_origen_id || !transForm.nombre_accion}>Crear</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
