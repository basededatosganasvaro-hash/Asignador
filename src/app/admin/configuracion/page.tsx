"use client";
import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";

interface Config {
  id: number;
  clave: string;
  valor: string;
}

export default function ConfiguracionPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [maxRegistros, setMaxRegistros] = useState("300");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  useEffect(() => {
    fetch("/api/admin/configuracion")
      .then((res) => res.json())
      .then((data: Config[]) => {
        setConfigs(data);
        const maxReg = data.find((c) => c.clave === "max_registros_por_dia");
        if (maxReg) setMaxRegistros(maxReg.valor);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clave: "max_registros_por_dia",
        valor: maxRegistros,
      }),
    });

    setSaving(false);

    if (res.ok) {
      setSnackbar({ open: true, message: "Configuracion guardada", severity: "success" });
    } else {
      setSnackbar({ open: true, message: "Error al guardar", severity: "error" });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Configuracion del Sistema
      </Typography>

      <Card sx={{ maxWidth: 600 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Asignaciones
          </Typography>
          <TextField
            fullWidth
            label="Maximo de registros por dia por promotor"
            type="number"
            value={maxRegistros}
            onChange={(e) => setMaxRegistros(e.target.value)}
            helperText="Cantidad maxima de registros que un promotor puede solicitar en un dia"
            inputProps={{ min: 1, max: 10000 }}
          />
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ mt: 3 }}
          >
            Guardar Cambios
          </Button>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
