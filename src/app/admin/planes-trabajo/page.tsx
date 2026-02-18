"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar, IconButton, FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

interface PlanTrabajo {
  id: number;
  convenio: string;
  activo: boolean;
  created_at: string;
  sucursal: { id: number; nombre: string };
  creador: { id: number; nombre: string };
}

interface Sucursal { id: number; nombre: string; }

export default function PlanesTrabajoPage() {
  const [rows, setRows] = useState<PlanTrabajo[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ sucursal_id: "", convenio: "" });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    const [p, s] = await Promise.all([
      fetch("/api/admin/planes-trabajo").then((res) => res.json()),
      fetch("/api/admin/organizacion/sucursales").then((res) => res.json()),
    ]);
    setRows(p);
    setSucursales(s);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    const res = await fetch("/api/admin/planes-trabajo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sucursal_id: Number(form.sucursal_id), convenio: form.convenio }),
    });
    if (res.ok) {
      setDialogOpen(false);
      setForm({ sucursal_id: "", convenio: "" });
      setSnackbar({ open: true, message: "Plan de trabajo creado", severity: "success" });
      fetchData();
    } else {
      const data = await res.json();
      setSnackbar({ open: true, message: data.error || "Error al crear", severity: "error" });
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch("/api/admin/planes-trabajo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { setSnackbar({ open: true, message: "Plan eliminado", severity: "success" }); fetchData(); }
  };

  const columns: GridColDef[] = [
    { field: "convenio", headerName: "Convenio", flex: 1 },
    { field: "sucursal", headerName: "Sucursal", flex: 1, valueGetter: (_v: unknown, row: PlanTrabajo) => row.sucursal?.nombre ?? "—" },
    { field: "creador", headerName: "Creado por", width: 160, valueGetter: (_v: unknown, row: PlanTrabajo) => row.creador?.nombre ?? "—" },
    {
      field: "created_at", headerName: "Fecha", width: 120,
      valueGetter: (_v: unknown, row: PlanTrabajo) => new Date(row.created_at).toLocaleDateString("es-MX"),
    },
    {
      field: "actions", headerName: "Acciones", width: 90, sortable: false,
      renderCell: (p) => (
        <IconButton size="small" onClick={() => handleDelete(p.row.id)} color="error" title="Eliminar">
          <DeleteIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Planes de Trabajo</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>Nuevo Plan</Button>
      </Box>
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick autoHeight sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }} />
      </Box>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nuevo Plan de Trabajo</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Sucursal</InputLabel>
            <Select value={form.sucursal_id} label="Sucursal" onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}>
              {sucursales.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Convenio" value={form.convenio} onChange={(e) => setForm({ ...form, convenio: e.target.value })} margin="normal" required autoFocus />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.sucursal_id || !form.convenio}>Crear</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
