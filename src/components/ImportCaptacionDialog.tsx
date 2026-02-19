"use client";
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, FormControl, InputLabel, Select,
  MenuItem, CircularProgress, Alert, Divider,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

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
  embedded?: boolean;
}

interface Convenio {
  id: number;
  nombre: string;
}

export default function ImportCaptacionDialog({ open, onClose, onSuccess, embedded = false }: Props) {
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

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/api/captaciones/template";
    link.download = "template_captaciones.xlsx";
    link.click();
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

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: embedded ? 0 : 1 }}>
      {/* Paso 1: Descargar template */}
      <Box
        sx={{
          p: 2,
          border: "2px dashed",
          borderColor: "primary.main",
          borderRadius: 2,
          bgcolor: "primary.50",
          textAlign: "center",
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
          Paso 1: Descarga el template
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          Llena el archivo Excel con los datos de tus prospectos y luego s&uacute;belo aqu&iacute;
        </Typography>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadTemplate}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Descargar Template Excel
        </Button>
      </Box>

      <Divider>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Paso 2: Configura la importaci&oacute;n
        </Typography>
      </Divider>

      <FormControl fullWidth size="small" required>
        <InputLabel>Origen de captaci&oacute;n</InputLabel>
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

      <Divider>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Paso 3: Sube tu archivo
        </Typography>
      </Divider>

      {/* Zona de subida de archivo */}
      <Box>
        <Button
          variant="outlined"
          component="label"
          startIcon={file ? <InsertDriveFileIcon /> : <UploadFileIcon />}
          fullWidth
          color={file ? "success" : "primary"}
          sx={{
            py: 2,
            borderStyle: file ? "solid" : "dashed",
            borderWidth: 2,
            textTransform: "none",
            fontWeight: file ? 600 : 400,
          }}
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
                    ...y {result.errors.length - 10} m&aacute;s
                  </Typography>
                )}
              </Box>
            </Alert>
          )}
        </Box>
      )}

      {embedded && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button onClick={handleClose} color="error" variant="outlined">
            Cancelar
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
        </Box>
      )}
    </Box>
  );

  if (embedded) return content;

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

      <DialogContent>{content}</DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="error" variant="outlined">
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
