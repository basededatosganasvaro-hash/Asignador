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

interface Zona {
  id: number;
  nombre: string;
  activo: boolean;
  region: { id: number; nombre: string };
  _count: { sucursales: number };
}

interface Region { id: number; nombre: string; }

export default function ZonasPage() {
  const [rows, setRows] = useState<Zona[]>([]);
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Zona | null>(null);
  const [form, setForm] = useState({ nombre: "", region_id: "" });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    const [z, r] = await Promise.all([
      fetch("/api/admin/organizacion/zonas").then((res) => res.json()),
      fetch("/api/admin/organizacion/regiones").then((res) => res.json()),
    ]);
    setRows(z);
    setRegiones(r);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenCreate = () => { setEditing(null); setForm({ nombre: "", region_id: "" }); setDialogOpen(true); };
  const handleOpenEdit = (row: Zona) => { setEditing(row); setForm({ nombre: row.nombre, region_id: String(row.region.id) }); setDialogOpen(true); };

  const handleSave = async () => {
    const url = editing ? `/api/admin/organizacion/zonas/${editing.id}` : "/api/admin/organizacion/zonas";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: form.nombre, region_id: Number(form.region_id) }) });
    if (res.ok) {
      setDialogOpen(false);
      setSnackbar({ open: true, message: editing ? "Zona actualizada" : "Zona creada", severity: "success" });
      fetchData();
    } else {
      const data = await res.json();
      setSnackbar({ open: true, message: data.error || "Error al guardar", severity: "error" });
    }
  };

  const handleToggle = async (row: Zona) => {
    const res = await fetch(`/api/admin/organizacion/zonas/${row.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !row.activo }),
    });
    if (res.ok) { setSnackbar({ open: true, message: row.activo ? "Desactivada" : "Activada", severity: "success" }); fetchData(); }
  };

  const columns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre", flex: 1 },
    { field: "region", headerName: "Región", flex: 1, valueGetter: (_v: unknown, row: Zona) => row.region?.nombre ?? "—" },
    { field: "sucursales", headerName: "Sucursales", width: 110, align: "center", headerAlign: "center", valueGetter: (_v: unknown, row: Zona) => row._count?.sucursales ?? 0 },
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
        <Typography variant="h4">Zonas</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>Nueva Zona</Button>
      </Box>
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "Editar Zona" : "Nueva Zona"}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} margin="normal" required autoFocus />
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Región</InputLabel>
            <Select value={form.region_id} label="Región" onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
              {regiones.map((r) => <MenuItem key={r.id} value={String(r.id)}>{r.nombre}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.nombre || !form.region_id}>{editing ? "Actualizar" : "Crear"}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
