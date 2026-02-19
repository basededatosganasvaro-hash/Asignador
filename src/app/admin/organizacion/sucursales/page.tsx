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

interface Sucursal {
  id: number;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  zona: { id: number; nombre: string; region: { id: number; nombre: string } };
  _count: { equipos: number; usuarios: number };
}

interface Zona { id: number; nombre: string; region: { nombre: string }; }

export default function SucursalesPage() {
  const [rows, setRows] = useState<Sucursal[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sucursal | null>(null);
  const [form, setForm] = useState({ nombre: "", zona_id: "", direccion: "" });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    const [s, z] = await Promise.all([
      fetch("/api/admin/organizacion/sucursales").then((res) => res.json()),
      fetch("/api/admin/organizacion/zonas").then((res) => res.json()),
    ]);
    setRows(s);
    setZonas(z);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenCreate = () => { setEditing(null); setForm({ nombre: "", zona_id: "", direccion: "" }); setDialogOpen(true); };
  const handleOpenEdit = (row: Sucursal) => {
    setEditing(row);
    setForm({ nombre: row.nombre, zona_id: String(row.zona.id), direccion: row.direccion ?? "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editing ? `/api/admin/organizacion/sucursales/${editing.id}` : "/api/admin/organizacion/sucursales";
    const method = editing ? "PUT" : "POST";
    const body = { nombre: form.nombre, zona_id: Number(form.zona_id), ...(form.direccion && { direccion: form.direccion }) };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setDialogOpen(false);
      setSnackbar({ open: true, message: editing ? "Sucursal actualizada" : "Sucursal creada", severity: "success" });
      fetchData();
    } else {
      const data = await res.json();
      setSnackbar({ open: true, message: data.error || "Error al guardar", severity: "error" });
    }
  };

  const handleToggle = async (row: Sucursal) => {
    const res = await fetch(`/api/admin/organizacion/sucursales/${row.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !row.activo }),
    });
    if (res.ok) { setSnackbar({ open: true, message: row.activo ? "Desactivada" : "Activada", severity: "success" }); fetchData(); }
  };

  const columns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre", flex: 1 },
    { field: "zona", headerName: "Zona", width: 140, valueGetter: (_v: unknown, row: Sucursal) => row.zona?.nombre ?? "—" },
    { field: "region", headerName: "Región", width: 140, valueGetter: (_v: unknown, row: Sucursal) => row.zona?.region?.nombre ?? "—" },
    { field: "equipos", headerName: "Equipos", width: 90, align: "center", headerAlign: "center", valueGetter: (_v: unknown, row: Sucursal) => row._count?.equipos ?? 0 },
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
        <Typography variant="h4">Sucursales</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>Nueva Sucursal</Button>
      </Box>
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "Editar Sucursal" : "Nueva Sucursal"}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} margin="normal" required autoFocus />
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Zona</InputLabel>
            <Select value={form.zona_id} label="Zona" onChange={(e) => setForm({ ...form, zona_id: e.target.value })}>
              {zonas.map((z) => <MenuItem key={z.id} value={String(z.id)}>{z.nombre} — {z.region.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Dirección (opcional)" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} margin="normal" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="error" variant="outlined">Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.nombre || !form.zona_id}>{editing ? "Actualizar" : "Crear"}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
