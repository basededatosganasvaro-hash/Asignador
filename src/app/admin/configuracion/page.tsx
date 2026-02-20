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
  Switch,
  FormControlLabel,
  Tooltip,
  Chip,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AssignmentIcon from "@mui/icons-material/Assignment";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import TimerIcon from "@mui/icons-material/Timer";
import BurstModeIcon from "@mui/icons-material/BurstMode";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import ShieldIcon from "@mui/icons-material/Shield";
import InfoIcon from "@mui/icons-material/Info";

interface Config {
  id: number;
  clave: string;
  valor: string;
}

// Defaults match microservice config
const WA_DEFAULTS: Record<string, number> = {
  wa_delay_min: 8000,
  wa_delay_max: 25000,
  wa_burst_min: 5,
  wa_burst_max: 12,
  wa_burst_pause_min: 120000,
  wa_burst_pause_max: 420000,
  wa_daily_limit: 180,
};

// Fields that store ms but display as seconds
const MS_FIELDS = new Set([
  "wa_delay_min",
  "wa_delay_max",
  "wa_burst_pause_min",
  "wa_burst_pause_max",
]);

function msToSeconds(key: string, val: number): number {
  return MS_FIELDS.has(key) ? Math.round(val / 1000) : val;
}

function secondsToMs(key: string, val: number): number {
  return MS_FIELDS.has(key) ? val * 1000 : val;
}

interface WaField {
  key: string;
  label: string;
  tooltip: string;
  unit: string;
}

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "Intervalo entre mensajes": <TimerIcon sx={{ fontSize: 18, color: "text.secondary" }} />,
  "Rafagas": <BurstModeIcon sx={{ fontSize: 18, color: "text.secondary" }} />,
  "Pausas entre rafagas": <PauseCircleIcon sx={{ fontSize: 18, color: "text.secondary" }} />,
  "Limite diario": <ShieldIcon sx={{ fontSize: 18, color: "text.secondary" }} />,
};

const WA_FIELD_GROUPS: { title: string; fields: WaField[] }[] = [
  {
    title: "Intervalo entre mensajes",
    fields: [
      {
        key: "wa_delay_min",
        label: "Delay minimo",
        tooltip: "Tiempo minimo de espera entre mensajes. Valores bajos aumentan riesgo de ban.",
        unit: "segundos",
      },
      {
        key: "wa_delay_max",
        label: "Delay maximo",
        tooltip: "Tiempo maximo de espera entre mensajes.",
        unit: "segundos",
      },
    ],
  },
  {
    title: "Rafagas",
    fields: [
      {
        key: "wa_burst_min",
        label: "Mensajes minimos por rafaga",
        tooltip: "Minimo de mensajes enviados antes de una pausa larga.",
        unit: "mensajes",
      },
      {
        key: "wa_burst_max",
        label: "Mensajes maximos por rafaga",
        tooltip: "Maximo de mensajes enviados antes de una pausa larga.",
        unit: "mensajes",
      },
    ],
  },
  {
    title: "Pausas entre rafagas",
    fields: [
      {
        key: "wa_burst_pause_min",
        label: "Pausa minima",
        tooltip: "Pausa minima entre rafagas. Ej: 120 = 2 minutos.",
        unit: "segundos",
      },
      {
        key: "wa_burst_pause_max",
        label: "Pausa maxima",
        tooltip: "Pausa maxima entre rafagas. Ej: 420 = 7 minutos.",
        unit: "segundos",
      },
    ],
  },
  {
    title: "Limite diario",
    fields: [
      {
        key: "wa_daily_limit",
        label: "Limite diario por promotor",
        tooltip: "Maximo de mensajes por promotor por dia. Protege contra spam.",
        unit: "mensajes",
      },
    ],
  },
];

const cardSx = {
  elevation: 0,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
};

export default function ConfiguracionPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [maxRegistros, setMaxRegistros] = useState("300");
  const [horarioActivo, setHorarioActivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // WhatsApp config state — display values (seconds for ms fields, raw for others)
  const [waValues, setWaValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [key, val] of Object.entries(WA_DEFAULTS)) {
      init[key] = String(msToSeconds(key, val));
    }
    return init;
  });
  const [waErrors, setWaErrors] = useState<Record<string, string>>({});
  const [waSaving, setWaSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/configuracion")
      .then((res) => res.json())
      .then((data: Config[]) => {
        setConfigs(data);
        const maxReg = data.find((c: Config) => c.clave === "max_registros_por_dia");
        if (maxReg) setMaxRegistros(maxReg.valor);
        const horario = data.find((c: Config) => c.clave === "horario_activo");
        if (horario) setHorarioActivo(horario.valor !== "false");

        // Load wa_* values from BD
        const newWaValues: Record<string, string> = {};
        for (const [key, defaultVal] of Object.entries(WA_DEFAULTS)) {
          const found = data.find((c: Config) => c.clave === key);
          const rawVal = found ? Number(found.valor) : defaultVal;
          newWaValues[key] = String(msToSeconds(key, rawVal));
        }
        setWaValues(newWaValues);

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

  // WhatsApp validation
  const validateWa = (): boolean => {
    const errors: Record<string, string> = {};
    const vals: Record<string, number> = {};

    for (const key of Object.keys(WA_DEFAULTS)) {
      const num = Number(waValues[key]);
      if (isNaN(num) || num <= 0) {
        errors[key] = "Debe ser mayor a 0";
      }
      vals[key] = num;
    }

    // Min <= Max pairs
    const pairs: [string, string, string][] = [
      ["wa_delay_min", "wa_delay_max", "Delay minimo no puede ser mayor que el maximo"],
      ["wa_burst_min", "wa_burst_max", "Burst minimo no puede ser mayor que el maximo"],
      ["wa_burst_pause_min", "wa_burst_pause_max", "Pausa minima no puede ser mayor que la maxima"],
    ];

    for (const [minKey, maxKey, msg] of pairs) {
      if (!errors[minKey] && !errors[maxKey] && vals[minKey] > vals[maxKey]) {
        errors[minKey] = msg;
        errors[maxKey] = msg;
      }
    }

    // Daily limit range
    if (!errors["wa_daily_limit"] && (vals["wa_daily_limit"] < 1 || vals["wa_daily_limit"] > 1000)) {
      errors["wa_daily_limit"] = "Debe estar entre 1 y 1000";
    }

    setWaErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleWaSave = async () => {
    if (!validateWa()) return;

    setWaSaving(true);
    let allOk = true;

    for (const [key, displayVal] of Object.entries(waValues)) {
      const storeVal = secondsToMs(key, Number(displayVal));
      const res = await fetch("/api/admin/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave: key, valor: String(storeVal) }),
      });
      if (!res.ok) allOk = false;
    }

    setWaSaving(false);
    setSnackbar({
      open: true,
      message: allOk ? "Configuracion WhatsApp guardada" : "Error al guardar algunos valores",
      severity: allOk ? "success" : "error",
    });
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
      {/* Header de pagina */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SettingsIcon sx={{ color: "white", fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Configuracion del Sistema
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Administra los parametros operativos del sistema
          </Typography>
        </Box>
      </Box>

      {/* Card Horario Operativo */}
      <Card elevation={0} sx={{ ...cardSx, maxWidth: 700, mb: 3, borderTop: "3px solid #2196f3" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <ScheduleIcon sx={{ color: "#2196f3" }} />
            <Typography variant="h6" fontWeight={600}>
              Horario Operativo
            </Typography>
            <Tooltip title="Controla la ventana horaria en que los promotores pueden acceder al sistema" arrow>
              <HelpOutlineIcon sx={{ fontSize: 18, color: "text.disabled", cursor: "help" }} />
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 4.5 }}>
            Controla si el sistema aplica la restriccion de horario para promotores (08:55 - 19:15 L-V).
          </Typography>
          <Box sx={{ ml: 4.5 }}>
            <Tooltip title="Cuando esta desactivado, los promotores pueden acceder en cualquier horario" arrow>
              <FormControlLabel
                control={
                  <Switch
                    checked={horarioActivo}
                    color="success"
                    onChange={async (e) => {
                      const nuevoValor = e.target.checked;
                      setHorarioActivo(nuevoValor);
                      const res = await fetch("/api/admin/configuracion", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clave: "horario_activo", valor: String(nuevoValor) }),
                      });
                      if (res.ok) {
                        setSnackbar({ open: true, message: nuevoValor ? "Horario activado" : "Horario desactivado", severity: "success" });
                      } else {
                        setHorarioActivo(!nuevoValor);
                        setSnackbar({ open: true, message: "Error al cambiar horario", severity: "error" });
                      }
                    }}
                  />
                }
                label={horarioActivo ? "Horario activo" : "Horario desactivado (acceso libre)"}
              />
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Card Asignaciones */}
      <Card elevation={0} sx={{ ...cardSx, maxWidth: 700, mb: 3, borderTop: "3px solid #4caf50" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <AssignmentIcon sx={{ color: "#4caf50" }} />
            <Typography variant="h6" fontWeight={600}>
              Asignaciones
            </Typography>
            <Tooltip title="Configura los limites de asignacion de registros para promotores" arrow>
              <HelpOutlineIcon sx={{ fontSize: 18, color: "text.disabled", cursor: "help" }} />
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 4.5 }}>
            Define cuantos registros puede solicitar cada promotor por dia.
          </Typography>
          <Box sx={{ ml: 4.5 }}>
            <Tooltip title="Controla cuantos registros puede solicitar cada promotor en un dia" arrow>
              <TextField
                fullWidth
                label="Maximo de registros por dia por promotor"
                type="number"
                value={maxRegistros}
                onChange={(e) => setMaxRegistros(e.target.value)}
                helperText="Cantidad maxima de registros que un promotor puede solicitar en un dia"
                inputProps={{ min: 1, max: 10000 }}
              />
            </Tooltip>
            <Button
              variant="contained"
              color="success"
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{ mt: 3 }}
            >
              Guardar Cambios
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Card WhatsApp Masivo */}
      <Card elevation={0} sx={{ ...cardSx, maxWidth: 700, borderTop: "3px solid #25D366" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <WhatsAppIcon sx={{ color: "#25D366" }} />
            <Typography variant="h6" fontWeight={600}>
              Configuracion de Envio Masivo WhatsApp
            </Typography>
            <Tooltip title="Parametros anti-spam que regulan la velocidad y volumen de envio de mensajes" arrow>
              <HelpOutlineIcon sx={{ fontSize: 18, color: "text.disabled", cursor: "help" }} />
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 4.5 }}>
            Parametros anti-spam para el envio masivo de mensajes.
          </Typography>

          <Box sx={{ ml: 4.5, mb: 3 }}>
            <Chip
              icon={<InfoIcon />}
              label="Los cambios aplican a partir de la siguiente campana"
              color="info"
              variant="outlined"
              size="small"
            />
          </Box>

          <Box sx={{ ml: 4.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
            {WA_FIELD_GROUPS.map((group) => (
              <Box key={group.title} sx={{ bgcolor: "grey.50", borderRadius: 2, p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  {GROUP_ICONS[group.title]}
                  <Typography variant="subtitle2" color="text.secondary">
                    {group.title}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {group.fields.map((field) => (
                    <TextField
                      key={field.key}
                      sx={{ flex: group.fields.length === 1 ? "1 1 100%" : "1 1 calc(50% - 8px)" }}
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          {field.label}
                          <Tooltip title={field.tooltip} arrow>
                            <HelpOutlineIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                          </Tooltip>
                        </Box>
                      }
                      type="number"
                      value={waValues[field.key]}
                      onChange={(e) => {
                        setWaValues((prev) => ({ ...prev, [field.key]: e.target.value }));
                        setWaErrors((prev) => {
                          const next = { ...prev };
                          delete next[field.key];
                          return next;
                        });
                      }}
                      error={!!waErrors[field.key]}
                      helperText={waErrors[field.key] || field.unit}
                      inputProps={{ min: 1 }}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ ml: 4.5, mt: 3 }}>
            <Tooltip title="Guarda todos los parametros anti-spam" arrow>
              <span>
                <Button
                  variant="contained"
                  startIcon={waSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleWaSave}
                  disabled={waSaving}
                  sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1da851" } }}
                >
                  Guardar Cambios
                </Button>
              </span>
            </Tooltip>
          </Box>
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
