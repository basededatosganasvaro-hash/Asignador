"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, Alert, Snackbar, IconButton, FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Equipo {
  id: number;
  nombre: string;
  activo: boolean;
  sucursal: { id: number; nombre: string } | null;
  supervisor: { id: number; nombre: string } | null;
  _count: { miembros: number };
}

interface Sucursal { id: number; nombre: string; }
interface Supervisor { id: number; nombre: string; }

export default function EquiposPage() {
  const [rows, setRows] = useState<Equipo[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipo | null>(null);
  const [form, setForm] = useState({ nombre: "", sucursal_id: "", supervisor_id: "" });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    const [e, s, u] = await Promise.all([
      fetch("/api/admin/organizacion/equipos").then((res) => res.json()),
      fetch("/api/admin/organizacion/sucursales").then((res) => res.json()),
      fetch("/api/admin/usuarios").then((res) => res.json()),
    ]);
    setRows(e);
    setSucursales(s);
    setSupervisores(u.filter((u: { rol: string }) => u.rol === "supervisor"));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenCreate = () => { setEditing(null); setForm({ nombre: "", sucursal_id: "", supervisor_id: "" }); setDialogOpen(true); };
  const handleOpenEdit = (row: Equipo) => {
    setEditing(row);
    setForm({ nombre: row.nombre, sucursal_id: row.sucursal ? String(row.sucursal.id) : "", supervisor_id: row.supervisor ? String(row.supervisor.id) : "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editing ? `/api/admin/organizacion/equipos/${editing.id}` : "/api/admin/organizacion/equipos";
    const method = editing ? "PUT" : "POST";
    const body = {
      nombre: form.nombre,
      sucursal_id: form.sucursal_id ? Number(form.sucursal_id) : null,
      supervisor_id: form.supervisor_id ? Number(form.supervisor_id) : null,
    };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setDialogOpen(false);
      setSnackbar({ open: true, message: editing ? "Equipo actualizado" : "Equipo creado", severity: "success" });
      fetchData();
    } else {
      const data = await res.json();
      setSnackbar({ open: true, message: data.error || "Error al guardar", severity: "error" });
    }
  };

  const handleToggle = async (row: Equipo) => {
    const res = await fetch(`/api/admin/organizacion/equipos/${row.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !row.activo }),
    });
    if (res.ok) { setSnackbar({ open: true, message: row.activo ? "Desactivado" : "Activado", severity: "success" }); fetchData(); }
  };

  const columns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre", flex: 1 },
    { field: "sucursal", headerName: "Sucursal", flex: 1, valueGetter: (_v: unknown, row: Equipo) => row.sucursal?.nombre ?? "—" },
    { field: "supervisor", headerName: "Supervisor", flex: 1, valueGetter: (_v: unknown, row: Equipo) => row.supervisor?.nombre ?? "Sin supervisor" },
    { field: "miembros", headerName: "Miembros", width: 100, align: "center", headerAlign: "center", valueGetter: (_v: unknown, row: Equipo) => row._count?.miembros ?? 0 },
    { field: "activo", headerName: "Estado", width: 100, renderCell: (p) => <Chip label={p.value ? "Activo" : "Inactivo"} color={p.value ? "success" : "default"} size="small" /> },
    {
      field: "actions", headerName: "Acciones", width: 110, sortable: false,
      renderCell: (p) => (
        <Box>
          <IconButton size="small" onClick={() => handleOpenEdit(p.row)} title="Editar"><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => handleToggle(p.row)} color={p.row.activo ? "error" : "success"} title={p.row.activo ? "Desactivar" : "Activar"}>
            {p.row.activo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Equipos</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>Nuevo Equipo</Button>
      </Box>
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "Editar Equipo" : "Nuevo Equipo"}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} margin="normal" required autoFocus />
          <FormControl fullWidth margin="normal">
            <InputLabel>Sucursal (opcional)</InputLabel>
            <Select value={form.sucursal_id} label="Sucursal (opcional)" onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}>
              <MenuItem value="">Sin sucursal</MenuItem>
              {sucursales.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Supervisor (opcional)</InputLabel>
            <Select value={form.supervisor_id} label="Supervisor (opcional)" onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}>
              <MenuItem value="">Sin supervisor</MenuItem>
              {supervisores.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="error" variant="outlined">Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.nombre}>{editing ? "Actualizar" : "Crear"}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
