"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Chip, Stack,
  Alert, CircularProgress, Snackbar,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageIcon from "@mui/icons-material/Image";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { getSupabaseClient } from "@/lib/supabase";
import type { RegistroPortabilidad } from "@/types/portabilidad";

function parseEvidencias(evidencia_url: string): string[] {
  if (!evidencia_url) return [];
  try {
    const parsed = JSON.parse(evidencia_url);
    return Array.isArray(parsed) ? parsed : [evidencia_url];
  } catch {
    return evidencia_url ? [evidencia_url] : [];
  }
}

export default function PortabilidadPage() {
  const [registros, setRegistros] = useState<RegistroPortabilidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // Filters
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroRfc, setFiltroRfc] = useState("");
  const [filtroFolio, setFiltroFolio] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [evidenciaDialog, setEvidenciaDialog] = useState<string[] | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    promotor_id: "",
    rfc_cliente: "",
    nombre_cliente: "",
    folio_portabilidad: "",
  });
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [formExistingUrls, setFormExistingUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroNombre) params.set("nombre", filtroNombre);
    if (filtroRfc) params.set("rfc", filtroRfc);
    if (filtroFolio) params.set("folio", filtroFolio);
    if (filtroDesde) params.set("desde", filtroDesde);
    if (filtroHasta) params.set("hasta", filtroHasta);

    const res = await fetch(`/api/operaciones/portabilidad?${params}`);
    if (res.ok) {
      setRegistros(await res.json());
    }
    setLoading(false);
  }, [filtroNombre, filtroRfc, filtroFolio, filtroDesde, filtroHasta]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  // Realtime subscription
  useEffect(() => {
    const channel = getSupabaseClient()
      .channel("registros-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registros" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRegistros((prev) => [payload.new as RegistroPortabilidad, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRegistros((prev) =>
              prev.map((r) => (r.id === (payload.new as RegistroPortabilidad).id ? (payload.new as RegistroPortabilidad) : r))
            );
          } else if (payload.eventType === "DELETE") {
            setRegistros((prev) => prev.filter((r) => r.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      getSupabaseClient().removeChannel(channel);
    };
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ promotor_id: "", rfc_cliente: "", nombre_cliente: "", folio_portabilidad: "" });
    setFormFiles([]);
    setFormExistingUrls([]);
    setFormOpen(true);
  };

  const openEdit = (row: RegistroPortabilidad) => {
    setEditingId(row.id);
    setFormData({
      promotor_id: String(row.promotor_id),
      rfc_cliente: row.rfc_cliente,
      nombre_cliente: row.nombre_cliente,
      folio_portabilidad: row.folio_portabilidad,
    });
    setFormFiles([]);
    setFormExistingUrls(parseEvidencias(row.evidencia_url));
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);

    // Upload new files
    const uploadedUrls: string[] = [...formExistingUrls];
    for (const file of formFiles) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/operaciones/portabilidad/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        uploadedUrls.push(url);
      } else {
        setSnack({ open: true, message: "Error al subir archivo", severity: "error" });
        setSaving(false);
        return;
      }
    }

    const evidencia_url = uploadedUrls.length === 0
      ? ""
      : uploadedUrls.length === 1
        ? uploadedUrls[0]
        : JSON.stringify(uploadedUrls);

    const body = {
      promotor_id: Number(formData.promotor_id),
      rfc_cliente: formData.rfc_cliente.toUpperCase(),
      nombre_cliente: formData.nombre_cliente,
      folio_portabilidad: formData.folio_portabilidad,
      evidencia_url,
    };

    let res;
    if (editingId) {
      res = await fetch(`/api/operaciones/portabilidad/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/operaciones/portabilidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (res.ok) {
      setSnack({ open: true, message: editingId ? "Registro actualizado" : "Registro creado", severity: "success" });
      setFormOpen(false);
      fetchRegistros();
    } else {
      const err = await res.json();
      setSnack({ open: true, message: err.error || "Error al guardar", severity: "error" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/operaciones/portabilidad/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setSnack({ open: true, message: "Registro eliminado", severity: "success" });
      fetchRegistros();
    } else {
      setSnack({ open: true, message: "Error al eliminar", severity: "error" });
    }
    setDeleteId(null);
  };

  const columns: GridColDef[] = [
    { field: "nombre_cliente", headerName: "Nombre", flex: 1, minWidth: 180 },
    { field: "rfc_cliente", headerName: "RFC", width: 150 },
    { field: "folio_portabilidad", headerName: "Folio", width: 150 },
    {
      field: "evidencia_url",
      headerName: "Evidencia",
      width: 120,
      renderCell: (params) => {
        const urls = parseEvidencias(params.value);
        if (urls.length === 0) return <Chip label="Sin archivos" size="small" variant="outlined" />;
        return (
          <Chip
            icon={<ImageIcon />}
            label={`${urls.length} archivo${urls.length > 1 ? "s" : ""}`}
            size="small"
            color="primary"
            variant="outlined"
            onClick={() => setEvidenciaDialog(urls)}
            sx={{ cursor: "pointer" }}
          />
        );
      },
    },
    {
      field: "created_at",
      headerName: "Fecha",
      width: 160,
      valueFormatter: (value: string) => {
        if (!value) return "";
        return new Date(value).toLocaleString("es-MX", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      },
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={() => openEdit(params.row)} color="primary">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setDeleteId(params.row.id)} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Portabilidad</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nuevo Registro
        </Button>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <TextField size="small" label="Nombre" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} sx={{ width: 180 }} />
        <TextField size="small" label="RFC" value={filtroRfc} onChange={(e) => setFiltroRfc(e.target.value)} sx={{ width: 150 }} />
        <TextField size="small" label="Folio" value={filtroFolio} onChange={(e) => setFiltroFolio(e.target.value)} sx={{ width: 150 }} />
        <TextField size="small" label="Desde" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
        <TextField size="small" label="Hasta" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
        <Button variant="outlined" startIcon={<SearchIcon />} onClick={fetchRegistros}>
          Buscar
        </Button>
      </Stack>

      {/* Table */}
      <DataGrid
        rows={registros}
        columns={columns}
        loading={loading}
        autoHeight
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        disableRowSelectionOnClick
        sx={{
          bgcolor: "background.paper",
          "& .MuiDataGrid-cell": { py: 1 },
        }}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Editar Registro" : "Nuevo Registro"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="ID Promotor (Telegram)"
              type="number"
              value={formData.promotor_id}
              onChange={(e) => setFormData({ ...formData, promotor_id: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="RFC Cliente"
              value={formData.rfc_cliente}
              onChange={(e) => setFormData({ ...formData, rfc_cliente: e.target.value.toUpperCase() })}
              required
              fullWidth
              inputProps={{ maxLength: 13 }}
            />
            <TextField
              label="Nombre Cliente"
              value={formData.nombre_cliente}
              onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Folio Portabilidad"
              value={formData.folio_portabilidad}
              onChange={(e) => setFormData({ ...formData, folio_portabilidad: e.target.value })}
              required
              fullWidth
            />

            {/* Existing evidencias */}
            {formExistingUrls.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Evidencias existentes:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {formExistingUrls.map((url, i) => (
                    <Chip
                      key={i}
                      label={`Archivo ${i + 1}`}
                      onDelete={() => setFormExistingUrls(formExistingUrls.filter((_, idx) => idx !== i))}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* File upload */}
            <Box>
              <Button variant="outlined" component="label" size="small">
                Agregar Evidencias (JPG, PNG, MP4)
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".jpg,.jpeg,.png,.mp4"
                  onChange={(e) => {
                    if (e.target.files) {
                      setFormFiles([...formFiles, ...Array.from(e.target.files)]);
                    }
                  }}
                />
              </Button>
              {formFiles.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  {formFiles.map((f, i) => (
                    <Chip
                      key={i}
                      label={f.name}
                      onDelete={() => setFormFiles(formFiles.filter((_, idx) => idx !== i))}
                      size="small"
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.promotor_id || !formData.rfc_cliente || !formData.nombre_cliente || !formData.folio_portabilidad}
          >
            {saving ? <CircularProgress size={20} /> : editingId ? "Actualizar" : "Crear"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            Esta acción eliminará el registro y sus evidencias de forma permanente.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Eliminar</Button>
        </DialogActions>
      </Dialog>

      {/* Evidencia Viewer */}
      <Dialog open={!!evidenciaDialog} onClose={() => setEvidenciaDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Evidencias
          <IconButton onClick={() => setEvidenciaDialog(null)} sx={{ position: "absolute", right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} alignItems="center">
            {evidenciaDialog?.map((url, i) => {
              const isVideo = url.match(/\.mp4/i);
              return isVideo ? (
                <video key={i} src={url} controls style={{ maxWidth: 400, maxHeight: 300, borderRadius: 8 }} />
              ) : (
                <Box key={i} component="img" src={url} alt={`Evidencia ${i + 1}`}
                  sx={{ maxWidth: 400, maxHeight: 300, objectFit: "contain", borderRadius: 2, border: "1px solid", borderColor: "divider" }}
                />
              );
            })}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
