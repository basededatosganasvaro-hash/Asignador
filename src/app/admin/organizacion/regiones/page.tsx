"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, Alert, Snackbar, IconButton,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Region {
  id: number;
  nombre: string;
  activo: boolean;
  _count: { zonas: number; usuarios: number };
}

export default function RegionesPage() {
  const [rows, setRows] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [nombre, setNombre] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/organizacion/regiones");
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenCreate = () => { setEditing(null); setNombre(""); setDialogOpen(true); };
  const handleOpenEdit = (row: Region) => { setEditing(row); setNombre(row.nombre); setDialogOpen(true); };

  const handleSave = async () => {
    const url = editing ? `/api/admin/organizacion/regiones/${editing.id}` : "/api/admin/organizacion/regiones";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    if (res.ok) {
      setDialogOpen(false);
      setSnackbar({ open: true, message: editing ? "Región actualizada" : "Región creada", severity: "success" });
      fetchData();
    } else {
      const data = await res.json();
      setSnackbar({ open: true, message: data.error || "Error al guardar", severity: "error" });
    }
  };

  const handleToggle = async (row: Region) => {
    const res = await fetch(`/api/admin/organizacion/regiones/${row.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !row.activo }),
    });
    if (res.ok) { setSnackbar({ open: true, message: row.activo ? "Desactivada" : "Activada", severity: "success" }); fetchData(); }
  };

  const columns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre", flex: 1 },
    { field: "zonas", headerName: "Zonas", width: 90, align: "center", headerAlign: "center", valueGetter: (_v: unknown, row: Region) => row._count?.zonas ?? 0 },
    { field: "usuarios", headerName: "Usuarios", width: 100, align: "center", headerAlign: "center", valueGetter: (_v: unknown, row: Region) => row._count?.usuarios ?? 0 },
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
        <Typography variant="h4">Regiones</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>Nueva Región</Button>
      </Box>
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "Editar Región" : "Nueva Región"}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} margin="normal" required autoFocus />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>{editing ? "Actualizar" : "Crear"}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
