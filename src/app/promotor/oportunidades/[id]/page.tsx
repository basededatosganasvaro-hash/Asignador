"use client";
import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Card, CardContent, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel, Select,
  MenuItem, Alert, Snackbar, CircularProgress, IconButton, Grid, Divider,
  Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PhoneIcon from "@mui/icons-material/Phone";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import SmsIcon from "@mui/icons-material/Sms";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

interface Transicion {
  id: number;
  nombre_accion: string;
  requiere_nota: boolean;
  requiere_supervisor: boolean;
  devuelve_al_pool: boolean;
  etapa_destino: { id: number; nombre: string; color: string; tipo: string } | null;
}

interface HistorialEntry {
  id: number;
  tipo: string;
  canal: string | null;
  nota: string | null;
  created_at: string;
  usuario: { id: number; nombre: string; rol: string };
  etapa_anterior: { id: number; nombre: string; color: string } | null;
  etapa_nueva: { id: number; nombre: string; color: string } | null;
}

interface OportunidadDetalle {
  id: number;
  cliente_id: number;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  timer_vence: string | null;
  activo: boolean;
  cliente: {
    nombres: string;
    tel_1?: string | null;
    tel_2?: string | null;
    curp?: string | null;
    rfc?: string | null;
    num_empleado?: string | null;
    convenio?: string | null;
    estado?: string | null;
    municipio?: string | null;
    oferta?: string | null;
  };
  transiciones: Transicion[];
  historial: HistorialEntry[];
}

const CANAL_ICONS: Record<string, React.ReactNode> = {
  LLAMADA: <PhoneIcon fontSize="small" />,
  WHATSAPP: <WhatsAppIcon fontSize="small" />,
  SMS: <SmsIcon fontSize="small" />,
};

function Confetti({ onClose }: { onClose: () => void }) {
  return (
    <Box sx={{ position: "fixed", inset: 0, bgcolor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card sx={{ p: 4, textAlign: "center", maxWidth: 360 }}>
        <EmojiEventsIcon sx={{ fontSize: 64, color: "#ffc107" }} />
        <Typography variant="h4" sx={{ mt: 2, fontWeight: 700 }}>¡Venta registrada!</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>Felicitaciones, la venta fue guardada exitosamente.</Typography>
        <Button variant="contained" sx={{ mt: 3 }} onClick={onClose} fullWidth>Continuar</Button>
      </Card>
    </Box>
  );
}

export default function OportunidadDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<OportunidadDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [confetti, setConfetti] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // Dialog estado
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTransicion, setSelectedTransicion] = useState<Transicion | null>(null);
  const [canal, setCanal] = useState("");
  const [nota, setNota] = useState("");
  const [numOperacion, setNumOperacion] = useState("");
  const [saving, setSaving] = useState(false);

  // Edición de datos de contacto
  const [editTel, setEditTel] = useState("");
  const [editTelOpen, setEditTelOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/oportunidades/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenTransicion = (t: Transicion) => {
    setSelectedTransicion(t);
    setCanal("");
    setNota("");
    setNumOperacion("");
    setDialogOpen(true);
  };

  const handleExecuteTransicion = async () => {
    if (!selectedTransicion) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/oportunidades/${id}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transicion_id: selectedTransicion.id,
          canal: canal || undefined,
          nota: nota || undefined,
          num_operacion: numOperacion || undefined,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setDialogOpen(false);
        if (result.confetti) {
          setConfetti(true);
        } else if (result.devuelta_al_pool) {
          setSnackbar({ open: true, message: "Oportunidad devuelta al pool", severity: "success" });
          setTimeout(() => router.push("/promotor/oportunidades"), 1500);
        } else {
          setSnackbar({ open: true, message: "Etapa actualizada", severity: "success" });
          fetchData();
        }
      } else {
        const err = await res.json().catch(() => ({ error: "Error al ejecutar" }));
        setSnackbar({ open: true, message: err.error || "Error al ejecutar", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Error de conexión", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditTel = async () => {
    try {
      const res = await fetch(`/api/clientes/${data!.cliente_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tel_1: editTel }),
      });
      if (res.ok) {
        setEditTelOpen(false);
        setSnackbar({ open: true, message: "Teléfono actualizado", severity: "success" });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({ error: "Error al guardar" }));
        setSnackbar({ open: true, message: err.error || "Error al guardar teléfono", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Error de conexión", severity: "error" });
    }
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (!data) return <Alert severity="error">No se encontró la oportunidad</Alert>;

  const esVenta = selectedTransicion?.etapa_destino?.tipo === "FINAL" && selectedTransicion?.etapa_destino?.nombre === "Venta";
  const timerVencido = data.timer_vence && new Date(data.timer_vence) < new Date();

  return (
    <Box>
      {confetti && <Confetti onClose={() => { setConfetti(false); router.push("/promotor/oportunidades"); }} />}

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.push("/promotor/oportunidades")}><ArrowBackIcon /></IconButton>
        <Typography variant="h5">Oportunidad #{data.id}</Typography>
        {data.etapa && <Chip label={data.etapa.nombre} sx={{ bgcolor: data.etapa.color, color: "white", fontWeight: 700 }} />}
        {timerVencido && <Chip label="Timer vencido" color="error" size="small" />}
      </Box>

      <Grid container spacing={3}>
        {/* Card datos del cliente */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Datos del Cliente</Typography>
              <Stack spacing={1}>
                <Row label="Nombre" value={data.cliente.nombres} />
                <Row label="Convenio" value={data.cliente.convenio} />
                <Row label="Estado / Municipio" value={`${data.cliente.estado ?? "—"} / ${data.cliente.municipio ?? "—"}`} />
                <Row label="Oferta" value={data.cliente.oferta} />
                <Divider />
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Tel 1</Typography>
                    <Typography>{data.cliente.tel_1 ?? <em>Sin teléfono</em>}</Typography>
                  </Box>
                  <Button size="small" onClick={() => { setEditTel(data.cliente.tel_1 ?? ""); setEditTelOpen(true); }}>Editar</Button>
                </Box>
                <Row label="CURP" value={data.cliente.curp} />
                <Row label="RFC" value={data.cliente.rfc} />
                <Row label="Num. Empleado" value={data.cliente.num_empleado} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Card acciones del embudo */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Acciones</Typography>
              {data.timer_vence && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 2, color: timerVencido ? "error.main" : "text.secondary" }}>
                  <AccessTimeIcon fontSize="small" />
                  <Typography variant="body2">
                    {timerVencido ? "Timer vencido" : `Vence: ${new Date(data.timer_vence).toLocaleString("es-MX")}`}
                  </Typography>
                </Box>
              )}
              {data.activo && data.transiciones.length > 0 ? (
                <Stack spacing={1}>
                  {data.transiciones.map((t) => (
                    <Button
                      key={t.id}
                      variant="outlined"
                      fullWidth
                      onClick={() => handleOpenTransicion(t)}
                      sx={{ justifyContent: "flex-start", textTransform: "none" }}
                      color={t.devuelve_al_pool ? "error" : t.etapa_destino?.tipo === "FINAL" ? "success" : "primary"}
                    >
                      {t.nombre_accion}
                      {t.etapa_destino && (
                        <Chip label={t.etapa_destino.nombre} size="small" sx={{ ml: "auto", bgcolor: t.etapa_destino.color, color: "white" }} />
                      )}
                      {t.devuelve_al_pool && <Chip label="Pool" size="small" sx={{ ml: "auto" }} />}
                    </Button>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>
                  {!data.activo ? "Esta oportunidad ya no está activa." : "No hay acciones disponibles para esta etapa."}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Historial */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Historial</Typography>
              {data.historial.length === 0 ? (
                <Typography color="text.secondary">Sin historial aún.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  {data.historial.map((entry) => (
                    <Box key={entry.id} sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                      <Box sx={{ color: "text.secondary", mt: 0.3 }}>{entry.canal ? CANAL_ICONS[entry.canal] : null}</Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                          {entry.etapa_anterior && <Chip label={entry.etapa_anterior.nombre} size="small" sx={{ bgcolor: entry.etapa_anterior.color, color: "white" }} />}
                          {entry.etapa_anterior && entry.etapa_nueva && <Typography variant="caption">→</Typography>}
                          {entry.etapa_nueva && <Chip label={entry.etapa_nueva.nombre} size="small" sx={{ bgcolor: entry.etapa_nueva.color, color: "white" }} />}
                          <Typography variant="caption" color="text.secondary">{entry.tipo}</Typography>
                        </Box>
                        {entry.nota && <Typography variant="body2" sx={{ mt: 0.5 }}>{entry.nota}</Typography>}
                        <Typography variant="caption" color="text.secondary">
                          {entry.usuario.nombre} · {new Date(entry.created_at).toLocaleString("es-MX")}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog ejecutar transicion */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{selectedTransicion?.nombre_accion}</DialogTitle>
        <DialogContent>
          {selectedTransicion?.etapa_destino && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Pasará a: <Chip label={selectedTransicion.etapa_destino.nombre} size="small" sx={{ bgcolor: selectedTransicion.etapa_destino.color, color: "white" }} />
              </Typography>
            </Box>
          )}
          <FormControl fullWidth margin="normal">
            <InputLabel>Canal de contacto</InputLabel>
            <Select value={canal} label="Canal de contacto" onChange={(e) => setCanal(e.target.value)}>
              <MenuItem value="">Sin canal</MenuItem>
              <MenuItem value="LLAMADA">📞 Llamada</MenuItem>
              <MenuItem value="WHATSAPP">💬 WhatsApp</MenuItem>
              <MenuItem value="SMS">📱 SMS</MenuItem>
            </Select>
          </FormControl>
          {selectedTransicion?.requiere_nota && (
            <TextField fullWidth label="Nota (requerida)" multiline rows={3} value={nota} onChange={(e) => setNota(e.target.value)} margin="normal" required />
          )}
          {esVenta && (
            <TextField fullWidth label="Número de operación" value={numOperacion} onChange={(e) => setNumOperacion(e.target.value)} margin="normal" required />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="error" variant="outlined">Cancelar</Button>
          <Button variant="contained" onClick={handleExecuteTransicion} disabled={saving || (selectedTransicion?.requiere_nota && !nota.trim()) || (esVenta && !numOperacion.trim())} color={selectedTransicion?.devuelve_al_pool ? "error" : "primary"}>
            {saving ? <CircularProgress size={20} /> : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog editar teléfono */}
      <Dialog open={editTelOpen} onClose={() => setEditTelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar Teléfono</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Tel 1" value={editTel} onChange={(e) => setEditTel(e.target.value)} margin="normal" autoFocus />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditTelOpen(false)} color="error" variant="outlined">Cancelar</Button>
          <Button variant="contained" onClick={handleEditTel}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography>{value ?? "—"}</Typography>
    </Box>
  );
}
