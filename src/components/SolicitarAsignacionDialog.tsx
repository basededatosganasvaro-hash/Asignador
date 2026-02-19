"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, MenuItem, Select,
  InputLabel, FormControl, Alert, CircularProgress,
  Switch, FormControlLabel, Chip, Divider, LinearProgress,
} from "@mui/material";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Opciones {
  tiposCliente: string[];
  convenios: string[];
  estados: string[];
  municipios: string[];
  disponibles: number;
  cupoRestante: number;
  asignables: number;
}

export default function SolicitarAsignacionDialog({ open, onClose, onSuccess }: Props) {
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [filtros, setFiltros] = useState({
    tipo_cliente: "",
    convenio: "",
    estado: "",
    municipio: "",
    tiene_telefono: false,
  });
  const [cantidad, setCantidad] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchOpciones = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.tipo_cliente) params.set("tipo_cliente", filtros.tipo_cliente);
      if (filtros.convenio) params.set("convenio", filtros.convenio);
      if (filtros.estado) params.set("estado", filtros.estado);
      if (filtros.municipio) params.set("municipio", filtros.municipio);
      if (filtros.tiene_telefono) params.set("tiene_telefono", "true");

      const res = await fetch(`/api/asignaciones/opciones?${params}`, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setOpciones(data);
        setCantidad(Math.min(data.asignables, 20));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Error fetching opciones:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    if (open) fetchOpciones();
    return () => abortRef.current?.abort();
  }, [open, fetchOpciones]);

  const handleClose = () => {
    setFiltros({ tipo_cliente: "", convenio: "", estado: "", municipio: "", tiene_telefono: false });
    setCantidad(0);
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/asignaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cantidad,
          ...filtros,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al solicitar asignación");
        return;
      }

      handleClose();
      onSuccess();
    } catch {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const maxAsignable = opciones?.asignables ?? 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AssignmentIndIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Solicitar Asignación</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          {/* Contadores */}
          {opciones && (
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Chip
                label={`En pool: ${opciones.disponibles}`}
                size="small"
                variant="outlined"
                color="info"
              />
              <Chip
                label={`Asignables: ${opciones.asignables}`}
                size="small"
                variant="outlined"
                color="success"
              />
              <Chip
                label={`Cupo hoy: ${opciones.cupoRestante}`}
                size="small"
                variant="outlined"
                color={opciones.cupoRestante > 0 ? "primary" : "error"}
              />
            </Box>
          )}

          {opciones && opciones.cupoRestante > 0 && (
            <LinearProgress
              variant="determinate"
              value={((300 - opciones.cupoRestante) / 300) * 100}
              sx={{ height: 6, borderRadius: 3 }}
            />
          )}

          <Divider />

          {/* Filtros cascada */}
          <FormControl fullWidth size="small">
            <InputLabel>Tipo de cliente</InputLabel>
            <Select
              value={filtros.tipo_cliente}
              label="Tipo de cliente"
              onChange={(e) => setFiltros((p) => ({ ...p, tipo_cliente: e.target.value, convenio: "", estado: "", municipio: "" }))}
            >
              <MenuItem value=""><em>Todos</em></MenuItem>
              {opciones?.tiposCliente?.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Convenio</InputLabel>
            <Select
              value={filtros.convenio}
              label="Convenio"
              onChange={(e) => setFiltros((p) => ({ ...p, convenio: e.target.value, estado: "", municipio: "" }))}
            >
              <MenuItem value=""><em>Todos</em></MenuItem>
              {opciones?.convenios?.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Estado</InputLabel>
            <Select
              value={filtros.estado}
              label="Estado"
              onChange={(e) => setFiltros((p) => ({ ...p, estado: e.target.value, municipio: "" }))}
            >
              <MenuItem value=""><em>Todos</em></MenuItem>
              {opciones?.estados?.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" disabled={!filtros.estado}>
            <InputLabel>Municipio</InputLabel>
            <Select
              value={filtros.municipio}
              label="Municipio"
              onChange={(e) => setFiltros((p) => ({ ...p, municipio: e.target.value }))}
            >
              <MenuItem value=""><em>Todos</em></MenuItem>
              {opciones?.municipios?.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={filtros.tiene_telefono}
                onChange={(e) => setFiltros((p) => ({ ...p, tiene_telefono: e.target.checked }))}
                size="small"
              />
            }
            label="Solo registros con teléfono"
          />

          <Divider />

          {/* Cantidad */}
          <TextField
            label="Cantidad a solicitar"
            type="number"
            size="small"
            fullWidth
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, Math.min(maxAsignable, Number(e.target.value))))}
            inputProps={{ min: 1, max: maxAsignable }}
            helperText={`Máximo disponible: ${maxAsignable}`}
            disabled={maxAsignable === 0}
          />

          {loading && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}

          {opciones?.cupoRestante === 0 && (
            <Alert severity="warning">
              Has alcanzado tu límite diario de asignaciones. Se reinicia mañana.
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || maxAsignable === 0 || cantidad <= 0 || (opciones?.cupoRestante ?? 0) === 0}
          startIcon={submitting ? <CircularProgress size={18} /> : <AssignmentIndIcon />}
        >
          {submitting ? "Asignando..." : `Asignar ${cantidad}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
