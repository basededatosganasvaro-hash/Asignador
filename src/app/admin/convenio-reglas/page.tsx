"use client";
import { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Autocomplete, Switch, FormControlLabel,
  Chip, IconButton, MenuItem, Select, InputLabel, FormControl,
  Alert,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

const CAMPOS_PREDEFINIDOS = [
  { value: "nss", label: "NSS" },
  { value: "curp", label: "CURP" },
  { value: "rfc", label: "RFC" },
  { value: "num_empleado", label: "Número de empleado" },
  { value: "tel_2", label: "Teléfono 2" },
  { value: "estado", label: "Estado" },
  { value: "municipio", label: "Municipio" },
  { value: "direccion_email", label: "Email" },
  { value: "a_paterno", label: "Apellido paterno" },
  { value: "a_materno", label: "Apellido materno" },
];

interface Regla {
  id: number;
  convenio: string;
  campo: string;
  obligatorio: boolean;
}

interface Convenio {
  id: number;
  nombre: string;
}

export default function ConvenioReglasPage() {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [filtroConvenio, setFiltroConvenio] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nuevo, setNuevo] = useState({ campo: "", obligatorio: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const cargarReglas = async () => {
    const res = await fetch("/api/admin/convenio-reglas");
    setReglas(await res.json());
  };

  const cargarConvenios = async () => {
    const res = await fetch("/api/captaciones/convenios");
    setConvenios(await res.json());
  };

  useEffect(() => {
    cargarReglas();
    cargarConvenios();
  }, []);

  const reglasFiltradas = filtroConvenio
    ? reglas.filter((r) => r.convenio === filtroConvenio)
    : reglas;

  const handleToggleObligatorio = async (regla: Regla) => {
    await fetch(`/api/admin/convenio-reglas/${regla.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obligatorio: !regla.obligatorio }),
    });
    cargarReglas();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    await fetch(`/api/admin/convenio-reglas/${id}`, { method: "DELETE" });
    cargarReglas();
  };

  const handleSave = async () => {
    if (!filtroConvenio) { setError("Selecciona un convenio primero"); return; }
    if (!nuevo.campo) { setError("Selecciona un campo"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/convenio-reglas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ convenio: filtroConvenio, campo: nuevo.campo, obligatorio: nuevo.obligatorio }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
      return;
    }
    setDialogOpen(false);
    setNuevo({ campo: "", obligatorio: true });
    cargarReglas();
  };

  const columns: GridColDef[] = [
    { field: "convenio", headerName: "Convenio", flex: 1.5, minWidth: 180 },
    {
      field: "campo",
      headerName: "Campo",
      flex: 1,
      minWidth: 150,
      renderCell: (params) => {
        const label = CAMPOS_PREDEFINIDOS.find((c) => c.value === params.value)?.label ?? params.value;
        return <Chip label={label} size="small" />;
      },
    },
    {
      field: "obligatorio",
      headerName: "Obligatorio",
      width: 130,
      renderCell: (params) => (
        <Switch
          checked={params.value}
          size="small"
          onChange={() => handleToggleObligatorio(params.row)}
        />
      ),
    },
    {
      field: "acciones",
      headerName: "",
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Reglas por Convenio</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setError(""); setDialogOpen(true); }}
          disabled={!filtroConvenio}
        >
          Agregar campo
        </Button>
      </Box>

      <Box sx={{ mb: 2, maxWidth: 400 }}>
        <FormControl fullWidth size="small">
          <InputLabel shrink>Filtrar por convenio</InputLabel>
          <Select
            value={filtroConvenio}
            label="Filtrar por convenio"
            onChange={(e) => setFiltroConvenio(e.target.value)}
            displayEmpty
            notched
          >
            <MenuItem value=""><em>Todos los convenios</em></MenuItem>
            {convenios.map((c) => (
              <MenuItem key={c.id} value={c.nombre}>{c.nombre}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Paper sx={{ height: 520 }}>
        <DataGrid
          rows={reglasFiltradas}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Agregar campo al convenio</DialogTitle>
        <DialogContent sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Convenio: <strong>{filtroConvenio}</strong>
          </Typography>
          <Autocomplete
            freeSolo
            options={CAMPOS_PREDEFINIDOS}
            getOptionLabel={(o) => typeof o === "string" ? o : o.label}
            onChange={(_, val) => {
              if (val && typeof val !== "string") setNuevo((p) => ({ ...p, campo: val.value }));
            }}
            onInputChange={(_, val) => setNuevo((p) => ({ ...p, campo: val }))}
            renderInput={(params) => (
              <TextField {...params} label="Campo" size="small" required />
            )}
          />
          <FormControlLabel
            control={
              <Switch
                checked={nuevo.obligatorio}
                onChange={(e) => setNuevo((p) => ({ ...p, obligatorio: e.target.checked }))}
              />
            }
            label="Obligatorio"
          />
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
