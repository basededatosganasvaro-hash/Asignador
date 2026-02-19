"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Alert, CircularProgress, Snackbar, Chip, Divider,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import RestoreIcon from "@mui/icons-material/Restore";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { WA_MENSAJES_DEFAULT, WA_ETAPAS_ORDEN } from "@/lib/whatsapp";

const ETAPA_COLORES: Record<string, string> = {
  Asignado: "#42A5F5",
  Contactado: "#FFA726",
  Interesado: "#AB47BC",
  "Negociación": "#66BB6A",
  Capturados: "#26C6DA",
};

const ETAPA_DESCRIPCIONES: Record<string, string> = {
  Asignado: "Primer contacto con el cliente asignado del pool",
  Contactado: "Seguimiento tras el primer contacto exitoso",
  Interesado: "El cliente mostró interés, avanzar con trámite",
  "Negociación": "Compartir propuesta y cerrar la venta",
  Capturados: "Clientes captados por ti directamente",
};

export default function ConfiguracionPage() {
  const [plantillas, setPlantillas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchPlantillas = useCallback(async () => {
    try {
      const res = await fetch("/api/promotor/plantillas-whatsapp");
      if (res.ok) {
        setPlantillas(await res.json());
      } else {
        // Si la API falla (ej: tabla no existe aún), usar defaults
        setPlantillas({ ...WA_MENSAJES_DEFAULT });
      }
    } catch {
      setPlantillas({ ...WA_MENSAJES_DEFAULT });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlantillas(); }, [fetchPlantillas]);

  const handleChange = (etapa: string, valor: string) => {
    setPlantillas((prev) => ({ ...prev, [etapa]: valor }));
  };

  const handleReset = (etapa: string) => {
    setPlantillas((prev) => ({ ...prev, [etapa]: WA_MENSAJES_DEFAULT[etapa] || "" }));
  };

  const handleResetAll = () => {
    setPlantillas({ ...WA_MENSAJES_DEFAULT });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/promotor/plantillas-whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plantillas),
      });
      if (res.ok) {
        setSnackbar({ open: true, message: "Plantillas guardadas correctamente", severity: "success" });
      } else {
        const data = await res.json();
        setSnackbar({ open: true, message: data.error || "Error al guardar", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Error de conexión", severity: "error" });
    }
    setSaving(false);
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
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <WhatsAppIcon sx={{ color: "#25D366", fontSize: 28 }} />
            <Typography variant="h5" fontWeight={600}>Mensajes de WhatsApp</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Personaliza el mensaje que se enviará a tus clientes en cada etapa del embudo
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestoreIcon />}
            onClick={handleResetAll}
            sx={{ textTransform: "none" }}
          >
            Restaurar todos
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </Box>
      </Box>

      {/* Info de variables */}
      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Variables disponibles:</Typography>
        <Typography variant="body2">
          <strong>{"{nombre}"}</strong> — Primer nombre del cliente &nbsp;&nbsp;|&nbsp;&nbsp;
          <strong>{"{promotor}"}</strong> — Tu nombre
        </Typography>
      </Alert>

      {/* Plantillas por etapa */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        {WA_ETAPAS_ORDEN.map((etapa) => (
          <Card
            key={etapa}
            variant="outlined"
            sx={{
              borderRadius: 3,
              borderLeft: "4px solid",
              borderLeftColor: ETAPA_COLORES[etapa] || "grey.400",
            }}
          >
            <CardContent sx={{ pb: "16px !important" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    label={etapa}
                    size="small"
                    sx={{
                      bgcolor: ETAPA_COLORES[etapa] || "grey.400",
                      color: "white",
                      fontWeight: 700,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {ETAPA_DESCRIPCIONES[etapa]}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<RestoreIcon sx={{ fontSize: 14 }} />}
                  onClick={() => handleReset(etapa)}
                  sx={{ textTransform: "none", fontSize: 12 }}
                >
                  Restaurar
                </Button>
              </Box>

              <TextField
                fullWidth
                multiline
                rows={3}
                value={plantillas[etapa] || ""}
                onChange={(e) => handleChange(etapa, e.target.value)}
                variant="outlined"
                size="small"
                placeholder={WA_MENSAJES_DEFAULT[etapa]}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    fontSize: 14,
                    bgcolor: "grey.50",
                  },
                }}
              />

              <Divider sx={{ my: 1.5 }} />

              {/* Preview */}
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <WhatsAppIcon sx={{ color: "#25D366", fontSize: 18, mt: 0.2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Vista previa:
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: 13, color: "text.secondary", fontStyle: "italic" }}>
                    {(plantillas[etapa] || "")
                      .replace(/\{nombre\}/g, "Carlos Pérez López")
                      .replace(/\{promotor\}/g, "Juan Pérez")
                    || "—"}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
