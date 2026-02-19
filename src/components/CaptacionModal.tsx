"use client";
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, MenuItem, Select,
  InputLabel, FormControl, Alert, CircularProgress, Chip,
  Divider, Tabs, Tab,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ImportCaptacionDialog from "@/components/ImportCaptacionDialog";

const ORIGENES = [
  { value: "CAMBACEO", label: "Cambaceo" },
  { value: "REFERIDO", label: "Referido" },
  { value: "REDES_SOCIALES", label: "Redes sociales" },
  { value: "MMP_PROSPECCION", label: "MMP Prospección" },
  { value: "CCC", label: "CCC" },
  { value: "EXCEL", label: "Excel" },
  { value: "OTRO", label: "Otro" },
];

const CAMPO_LABELS: Record<string, string> = {
  nss: "NSS",
  curp: "CURP",
  rfc: "RFC",
  num_empleado: "Número de empleado",
  tel_2: "Teléfono 2",
  estado: "Estado",
  municipio: "Municipio",
  direccion_email: "Email",
  a_paterno: "Apellido paterno",
  a_materno: "Apellido materno",
};

interface Convenio { id: number; nombre: string; }
interface Regla { id: number; campo: string; obligatorio: boolean; }

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (opId: number) => void;
}

export default function CaptacionModal({ open, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState(0);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [form, setForm] = useState<Record<string, string>>({
    origen_captacion: "",
    convenio: "",
    nombres: "",
    a_paterno: "",
    a_materno: "",
    tel_1: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingReglas, setLoadingReglas] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/captaciones/convenios")
        .then((r) => r.json())
        .then(setConvenios);
    }
  }, [open]);

  const resetForm = () => {
    setForm({
      origen_captacion: "",
      convenio: "",
      nombres: "",
      a_paterno: "",
      a_materno: "",
      tel_1: "",
    });
    setReglas([]);
    setError("");
    setTab(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleConvenioChange = async (convenio: string) => {
    setForm((p) => ({ ...p, convenio }));
    if (!convenio) { setReglas([]); return; }
    setLoadingReglas(true);
    const res = await fetch(`/api/captaciones/reglas?convenio=${encodeURIComponent(convenio)}`);
    setReglas(await res.json());
    setLoadingReglas(false);
  };

  const handleField = (campo: string, valor: string) => {
    setForm((p) => ({ ...p, [campo]: valor }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.origen_captacion || !form.convenio) {
      setError("Selecciona el origen y el convenio");
      return;
    }

    const { origen_captacion, convenio, ...datosRest } = form;
    const datos = Object.fromEntries(
      Object.entries(datosRest).filter(([, v]) => v.trim() !== "")
    );

    setSaving(true);
    const res = await fetch("/api/captaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origen_captacion, convenio, datos }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al captar");
      return;
    }

    const { id } = await res.json();
    resetForm();
    onSuccess(id);
  };

  const camposBase = ["nombres", "a_paterno", "a_materno", "tel_1"];
  const camposExtra = reglas.filter((r) => !camposBase.includes(r.campo));

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PersonAddIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Captar Cliente</Typography>
        </Box>
      </DialogTitle>

      <Box sx={{ px: 3, pt: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13 },
          }}
        >
          <Tab
            icon={<PersonAddIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Individual"
          />
          <Tab
            icon={<UploadFileIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Carga Masiva"
          />
        </Tabs>
      </Box>

      {tab === 0 ? (
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Origen de captaci&oacute;n</InputLabel>
                <Select
                  value={form.origen_captacion}
                  label="Origen de captación"
                  onChange={(e) => handleField("origen_captacion", e.target.value)}
                >
                  {ORIGENES.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" required>
                <InputLabel>Convenio</InputLabel>
                <Select
                  value={form.convenio}
                  label="Convenio"
                  onChange={(e) => handleConvenioChange(e.target.value)}
                >
                  {convenios.map((c) => (
                    <MenuItem key={c.id} value={c.nombre}>{c.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider />

              <TextField
                label="Nombres *"
                size="small"
                fullWidth
                value={form.nombres}
                onChange={(e) => handleField("nombres", e.target.value)}
                required
              />

              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  label="Apellido paterno"
                  size="small"
                  fullWidth
                  value={form.a_paterno}
                  onChange={(e) => handleField("a_paterno", e.target.value)}
                />
                <TextField
                  label="Apellido materno"
                  size="small"
                  fullWidth
                  value={form.a_materno}
                  onChange={(e) => handleField("a_materno", e.target.value)}
                />
              </Box>

              <TextField
                label="Teléfono *"
                size="small"
                fullWidth
                value={form.tel_1}
                onChange={(e) => handleField("tel_1", e.target.value)}
                required
              />

              {loadingReglas && <CircularProgress size={20} />}

              {camposExtra.length > 0 && (
                <>
                  <Divider />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Campos del convenio
                    </Typography>
                    <Chip label={form.convenio} size="small" variant="outlined" />
                  </Box>
                  {camposExtra.map((regla) => (
                    <TextField
                      key={regla.campo}
                      label={`${CAMPO_LABELS[regla.campo] ?? regla.campo}${regla.obligatorio ? " *" : ""}`}
                      size="small"
                      fullWidth
                      required={regla.obligatorio}
                      value={form[regla.campo] ?? ""}
                      onChange={(e) => handleField(regla.campo, e.target.value)}
                    />
                  ))}
                </>
              )}

              {error && <Alert severity="error">{error}</Alert>}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleClose} color="error" variant="outlined">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} /> : <PersonAddIcon />}
            >
              {saving ? "Guardando..." : "Captar"}
            </Button>
          </DialogActions>
        </form>
      ) : (
        <DialogContent sx={{ pt: 2 }}>
          <ImportCaptacionDialog
            open={true}
            onClose={handleClose}
            onSuccess={() => {
              resetForm();
              onSuccess(0);
            }}
            embedded
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
