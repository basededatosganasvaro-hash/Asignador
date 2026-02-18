"use client";
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, FormControl, InputLabel, Select,
  MenuItem, CircularProgress, Alert, Chip, Divider,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

const ORIGENES = [
  { value: "CAMBACEO", label: "Cambaceo" },
  { value: "REFERIDO", label: "Referido" },
  { value: "REDES_SOCIALES", label: "Redes sociales" },
  { value: "MMP_PROSPECCION", label: "MMP Prospección" },
  { value: "CCC", label: "CCC" },
  { value: "EXCEL", label: "Excel" },
  { value: "OTRO", label: "Otro" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Convenio {
  id: number;
  nombre: string;
}

export default function ImportCaptacionDialog({ open, onClose, onSuccess }: Props) {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [origen, setOrigen] = useState("");
  const [convenio, setConvenio] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetch("/api/captaciones/convenios")
        .then((r) => r.json())
        .then(setConvenios)
        .catch(() => {});
    }
  }, [open]);

  const handleClose = () => {
    setOrigen("");
    setConvenio("");
    setFile(null);
    setResult(null);
    setError("");
    onClose();
  };

  const handleUpload = async () => {
    if (!file || !origen || !convenio) return;

    setUploading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("origen_captacion", origen);
    formData.append("convenio", convenio);

    try {
      const res = await fetch("/api/captaciones/importar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al importar");
        if (data.errors) setResult({ created: 0, errors: data.errors });
      } else {
        setResult(data);
        if (data.created > 0) {
          setTimeout(() => {
            onSuccess();
          }, 2000);
        }
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <UploadFileIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Importar Clientes Capturados</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Sube un archivo Excel (.xlsx) con los datos de los prospectos
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
          <FormControl fullWidth size="small" required>
            <InputLabel>Origen de captación</InputLabel>
            <Select value={origen} label="Origen de captación" onChange={(e) => setOrigen(e.target.value)}>
              {ORIGENES.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" required>
            <InputLabel>Convenio</InputLabel>
            <Select value={convenio} label="Convenio" onChange={(e) => setConvenio(e.target.value)}>
              {convenios.map((c) => (
                <MenuItem key={c.id} value={c.nombre}>{c.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          <Box>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              fullWidth
              sx={{ py: 2, borderStyle: "dashed", textTransform: "none" }}
            >
              {file ? file.name : "Seleccionar archivo Excel (.xlsx)"}
              <input
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setResult(null);
                  setError("");
                }}
              />
            </Button>
          </Box>

          <Alert severity="info" variant="outlined" sx={{ fontSize: 12 }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Columnas esperadas:</Typography>
            <Typography variant="caption">
              nombres, a_paterno, a_materno, tel_1 (requeridos) — nss, curp, rfc, num_empleado, tel_2, estado, municipio, email (opcionales)
            </Typography>
          </Alert>

          {error && <Alert severity="error">{error}</Alert>}

          {result && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {result.created > 0 && (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  {result.created} cliente{result.created !== 1 ? "s" : ""} importado{result.created !== 1 ? "s" : ""} exitosamente
                </Alert>
              )}
              {result.errors.length > 0 && (
                <Alert severity="warning" icon={<ErrorIcon />}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                    {result.errors.length} fila{result.errors.length !== 1 ? "s" : ""} con errores:
                  </Typography>
                  <Box sx={{ maxHeight: 120, overflow: "auto" }}>
                    {result.errors.slice(0, 10).map((e, i) => (
                      <Typography key={i} variant="caption" display="block">
                        Fila {e.row}: {e.message}
                      </Typography>
                    ))}
                    {result.errors.length > 10 && (
                      <Typography variant="caption" color="text.secondary">
                        ...y {result.errors.length - 10} más
                      </Typography>
                    )}
                  </Box>
                </Alert>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>
          {result?.created ? "Cerrar" : "Cancelar"}
        </Button>
        {!result?.created && (
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={uploading || !file || !origen || !convenio}
            startIcon={uploading ? <CircularProgress size={18} /> : <UploadFileIcon />}
          >
            {uploading ? "Importando..." : "Importar"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
