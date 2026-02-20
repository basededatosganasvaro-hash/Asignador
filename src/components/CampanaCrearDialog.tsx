"use client";
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, TextField, Stepper, Step, StepLabel,
  CircularProgress, Alert, Chip, List, ListItem, ListItemText,
  IconButton, Paper,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SendIcon from "@mui/icons-material/Send";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

interface Destinatario {
  oportunidad_id: number;
  numero_destino: string;
  nombre_cliente: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  destinatarios: Destinatario[];
  mensajeInicial?: string;
}

const STEPS = ["Destinatarios", "Mensaje", "Variaciones IA", "Confirmar"];

export default function CampanaCrearDialog({ open, onClose, onSuccess, destinatarios, mensajeInicial = "" }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [nombre, setNombre] = useState("");
  const [mensajeBase, setMensajeBase] = useState(mensajeInicial);
  const [variaciones, setVariaciones] = useState<string[]>([]);
  const [generandoIA, setGenerandoIA] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const handleGenerarVariaciones = async () => {
    if (!mensajeBase.trim()) return;
    setGenerandoIA(true);
    setError("");

    try {
      const res = await fetch("/api/whatsapp/variaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje_base: mensajeBase, cantidad: destinatarios.length }),
      });
      if (!res.ok) throw new Error("Error al generar variaciones");
      const data = await res.json();
      setVariaciones(data.variaciones || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar variaciones");
    } finally {
      setGenerandoIA(false);
    }
  };

  const handleLanzar = async () => {
    setEnviando(true);
    setError("");

    try {
      const res = await fetch("/api/whatsapp/campanas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre || `Campaña ${new Date().toLocaleDateString("es-MX")}`,
          mensaje_base: mensajeBase,
          variaciones: variaciones.length > 0 ? variaciones : undefined,
          destinatarios,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear campaña");
      }
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setEnviando(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setNombre("");
    setMensajeBase(mensajeInicial);
    setVariaciones([]);
    setError("");
    onClose();
  };

  const canNext = () => {
    if (activeStep === 0) return destinatarios.length > 0;
    if (activeStep === 1) return mensajeBase.trim().length > 0;
    if (activeStep === 2) return true; // Variaciones son opcionales
    return true;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle>
        <Typography variant="h6" fontWeight={700}>Crear Campaña WhatsApp</Typography>
        <Stepper activeStep={activeStep} sx={{ mt: 2 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>

      <DialogContent sx={{ minHeight: 300 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Step 0: Destinatarios */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Se enviarán mensajes a {destinatarios.length} cliente{destinatarios.length !== 1 ? "s" : ""} seleccionados.
            </Typography>
            <TextField
              fullWidth label="Nombre de la campaña (opcional)" size="small"
              value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder={`Campaña ${new Date().toLocaleDateString("es-MX")}`}
              sx={{ mb: 2 }}
            />
            <Paper variant="outlined" sx={{ maxHeight: 200, overflow: "auto", borderRadius: 2 }}>
              <List dense>
                {destinatarios.slice(0, 20).map((d, i) => (
                  <ListItem key={i}>
                    <ListItemText
                      primary={d.nombre_cliente}
                      secondary={d.numero_destino}
                      primaryTypographyProps={{ fontSize: 13 }}
                      secondaryTypographyProps={{ fontSize: 11 }}
                    />
                  </ListItem>
                ))}
                {destinatarios.length > 20 && (
                  <ListItem>
                    <ListItemText primary={`... y ${destinatarios.length - 20} más`} primaryTypographyProps={{ fontSize: 12, color: "text.secondary" }} />
                  </ListItem>
                )}
              </List>
            </Paper>
          </Box>
        )}

        {/* Step 1: Mensaje */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Escribe el mensaje base. Usa <strong>{"{nombre}"}</strong> para insertar el nombre del cliente.
            </Typography>
            <TextField
              fullWidth multiline rows={6} value={mensajeBase}
              onChange={(e) => setMensajeBase(e.target.value)}
              placeholder="Hola {nombre}, le saludo de parte de..."
              sx={{ mb: 2 }}
            />
            <Typography variant="caption" color="text.secondary">
              {mensajeBase.length} caracteres
            </Typography>
          </Box>
        )}

        {/* Step 2: Variaciones IA */}
        {activeStep === 2 && (
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                Genera variaciones con IA para evitar detección de spam. Cada destinatario recibirá una variación diferente.
              </Typography>
              <Button
                variant="contained" startIcon={generandoIA ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
                onClick={handleGenerarVariaciones}
                disabled={generandoIA || !mensajeBase.trim()}
                sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
              >
                {generandoIA ? "Generando..." : variaciones.length > 0 ? "Regenerar" : "Generar Variaciones"}
              </Button>
            </Box>

            {variaciones.length > 0 && (
              <>
                <Chip label={`${variaciones.length} variaciones`} size="small" color="success" sx={{ mb: 1 }} />
                <Paper variant="outlined" sx={{ maxHeight: 300, overflow: "auto", borderRadius: 2 }}>
                  <List dense>
                    {variaciones.map((v, i) => (
                      <ListItem
                        key={i}
                        secondaryAction={
                          editIdx === i ? null : (
                            <Box>
                              <IconButton size="small" onClick={() => { setEditIdx(i); setEditText(v); }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" onClick={() => setVariaciones((prev) => prev.filter((_, j) => j !== i))}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          )
                        }
                      >
                        {editIdx === i ? (
                          <Box sx={{ display: "flex", gap: 1, width: "100%", pr: 2 }}>
                            <TextField
                              fullWidth multiline size="small" value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              autoFocus
                            />
                            <Button
                              size="small" variant="contained"
                              onClick={() => {
                                setVariaciones((prev) => prev.map((val, j) => j === i ? editText : val));
                                setEditIdx(null);
                              }}
                            >
                              OK
                            </Button>
                          </Box>
                        ) : (
                          <ListItemText
                            primary={`#${i + 1}`}
                            secondary={v}
                            primaryTypographyProps={{ fontSize: 11, fontWeight: 600, color: "text.secondary" }}
                            secondaryTypographyProps={{ fontSize: 12 }}
                          />
                        )}
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </>
            )}

            {variaciones.length === 0 && !generandoIA && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Puedes omitir este paso. Sin variaciones, todos los destinatarios recibirán el mismo mensaje.
              </Alert>
            )}
          </Box>
        )}

        {/* Step 3: Confirmar */}
        {activeStep === 3 && (
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Resumen de la campaña</Typography>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 1, "& > :nth-of-type(odd)": { color: "text.secondary", fontSize: 13 }, "& > :nth-of-type(even)": { fontWeight: 600, fontSize: 13 } }}>
                <Typography>Nombre:</Typography>
                <Typography>{nombre || `Campaña ${new Date().toLocaleDateString("es-MX")}`}</Typography>
                <Typography>Destinatarios:</Typography>
                <Typography>{destinatarios.length}</Typography>
                <Typography>Variaciones IA:</Typography>
                <Typography>{variaciones.length > 0 ? `${variaciones.length} variaciones` : "Sin variaciones"}</Typography>
              </Box>
            </Paper>

            <Alert severity="warning" sx={{ mt: 2 }}>
              Los mensajes se enviarán con delays aleatorios (8-25s) para evitar bloqueos.
              Límite diario: 180 mensajes. La campaña puede pausarse si se alcanza el límite.
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
        <Button onClick={handleClose} color="error" variant="outlined">Cancelar</Button>
        <Box sx={{ display: "flex", gap: 1 }}>
          {activeStep > 0 && (
            <Button onClick={() => setActiveStep((s) => s - 1)} variant="outlined">Atrás</Button>
          )}
          {activeStep < STEPS.length - 1 ? (
            <Button onClick={() => setActiveStep((s) => s + 1)} variant="contained" disabled={!canNext()}>
              Siguiente
            </Button>
          ) : (
            <Button
              onClick={handleLanzar} variant="contained" color="success"
              startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              disabled={enviando}
            >
              {enviando ? "Creando..." : "Iniciar Envío"}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
