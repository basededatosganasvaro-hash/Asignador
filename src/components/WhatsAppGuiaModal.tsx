"use client";
import { useState } from "react";
import {
  Dialog, DialogContent, Box, Typography, MobileStepper, Button,
} from "@mui/material";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";

const slides = [
  {
    emoji: "🌱",
    titulo: "Proceso de Maduración",
    puntos: [
      "Inicia con pocos mensajes: 5 el primer día, 10 el segundo, 20 el tercero.",
      "Escala progresivamente hasta tu volumen objetivo.",
      "Un número nuevo que envía 200 mensajes el día 1 será bloqueado casi seguro.",
      "Necesitas interacción real: responde mensajes, haz llamadas, usa WhatsApp normalmente.",
    ],
  },
  {
    emoji: "🔀",
    titulo: "Variación de Contenido",
    puntos: [
      "Nunca envíes el mismo texto idéntico a todos. Rota entre 3-5 variaciones.",
      "Cada archivo (imagen/PDF) tiene un hash único. Si envías el mismo archivo 50 veces, WhatsApp lo detecta.",
      "Cambia nombres de archivos, redimensiona imágenes o agrega pequeñas variaciones.",
      "Alterna entre mensajes con y sin multimedia.",
    ],
  },
  {
    emoji: "⏱️",
    titulo: "Gestión de Tiempos",
    puntos: [
      "Usa intervalos irregulares entre mensajes (no exactamente cada 30 seg).",
      "Descansa 5-10 minutos tras cada bloque de 15-20 mensajes.",
      "Evita enviar en horarios inusuales (madrugada, muy temprano).",
      "Si recibes una advertencia de WhatsApp, detén los envíos por 24 horas.",
    ],
  },
  {
    emoji: "🤝",
    titulo: "Contacto Guardado",
    puntos: [
      "Los mensajes a contactos guardados tienen menor riesgo de reporte.",
      "Pide a tus clientes que guarden tu número antes del primer mensaje.",
      "Usa una entrada amigable: 'Hola, soy [nombre] de [empresa], guardé tu contacto'.",
      "La sincronización de contactos reduce la tasa de bloqueo significativamente.",
    ],
  },
  {
    emoji: "💬",
    titulo: "Fomentar Respuesta",
    puntos: [
      "Un chat donde solo tú hablas parece spam. Haz preguntas abiertas.",
      "Ejemplo: '¿Le gustaría conocer más detalles?' en vez de solo informar.",
      "Las respuestas del cliente validan tu número ante WhatsApp.",
      "Evita el modelo broadcast unidireccional: busca conversación real.",
    ],
  },
  {
    emoji: "🧹",
    titulo: "Higiene de Base de Datos",
    puntos: [
      "Verifica que los números existan en WhatsApp antes de enviar.",
      "Enviar a números inexistentes o dados de baja aumenta tu riesgo.",
      "Limpia tu lista: elimina números que nunca responden tras 3 intentos.",
      "Prioriza contactos con historial de respuesta positiva.",
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function WhatsAppGuiaModal({ open, onClose }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const maxSteps = slides.length;
  const slide = slides[activeStep];
  const isLast = activeStep === maxSteps - 1;

  const handleClose = () => {
    setActiveStep(0);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogContent sx={{ p: 3, pb: 1 }}>
        <Box sx={{ minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ fontSize: 48, lineHeight: 1, mb: 1.5 }}>{slide.emoji}</Typography>
          <Typography variant="h6" fontWeight={700} align="center" sx={{ mb: 2 }}>
            {slide.titulo}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, width: "100%" }}>
            {slide.puntos.map((p, i) => (
              <Typography key={i} component="li" variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                {p}
              </Typography>
            ))}
          </Box>
        </Box>

        <MobileStepper
          variant="dots"
          steps={maxSteps}
          position="static"
          activeStep={activeStep}
          sx={{ bgcolor: "transparent", mt: 1 }}
          backButton={
            <Button size="small" onClick={() => setActiveStep((s) => s - 1)} disabled={activeStep === 0}>
              <KeyboardArrowLeft /> Atrás
            </Button>
          }
          nextButton={
            isLast ? (
              <Button size="small" onClick={handleClose} sx={{ fontWeight: 700 }}>
                Entendido ✓
              </Button>
            ) : (
              <Button size="small" onClick={() => setActiveStep((s) => s + 1)}>
                Siguiente <KeyboardArrowRight />
              </Button>
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}
