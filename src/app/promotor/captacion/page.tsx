"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Paper, Button, TextField, MenuItem, Select,
  InputLabel, FormControl, Alert, CircularProgress, Chip, Divider,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

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

interface Convenio {
  id: number;
  nombre: string;
}

interface Regla {
  id: number;
  campo: string;
  obligatorio: boolean;
}

export default function CaptacionPage() {
  const router = useRouter();
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
    fetch("/api/captaciones/convenios")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setConvenios)
      .catch(() => setError("Error al cargar convenios"));
  }, []);

  const handleConvenioChange = async (convenio: string) => {
    setForm((p) => ({ ...p, convenio }));
    if (!convenio) { setReglas([]); return; }
    setLoadingReglas(true);
    try {
      const res = await fetch(`/api/captaciones/reglas?convenio=${encodeURIComponent(convenio)}`);
      if (!res.ok) throw new Error();
      setReglas(await res.json());
    } catch {
      setError("Error al cargar reglas del convenio");
    } finally {
      setLoadingReglas(false);
    }
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
    try {
      const res = await fetch("/api/captaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origen_captacion, convenio, datos }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.oportunidad_id) {
          router.push(`/promotor/oportunidades/${data.oportunidad_id}`);
          return;
        }
        setError(data.error ?? "Error al captar");
        return;
      }

      const { id } = await res.json();
      router.push(`/promotor/oportunidades/${id}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  // Campos extra del convenio (excluyendo los base que ya se muestran)
  const camposBase = ["nombres", "a_paterno", "a_materno", "tel_1"];
  const camposExtra = reglas.filter((r) => !camposBase.includes(r.campo));

  return (
    <Box maxWidth={600} mx="auto">
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <PersonAddIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700}>Captar cliente</Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

            {/* Origen y convenio */}
            <FormControl fullWidth size="small" required>
              <InputLabel>Origen de captación</InputLabel>
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

            {/* Datos base del prospecto */}
            <Typography variant="subtitle2" color="text.secondary">Datos del prospecto</Typography>

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

            {/* Campos extra por convenio */}
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

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} /> : <PersonAddIcon />}
            >
              {saving ? "Guardando..." : "Captar cliente"}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
