"use client";
import { useState } from "react";
import { Dialog, DialogBody } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    emoji: "\u{1F331}",
    titulo: "Proceso de Maduracion",
    puntos: [
      "Inicia con pocos mensajes: 5 el primer dia, 10 el segundo, 20 el tercero.",
      "Escala progresivamente hasta tu volumen objetivo.",
      "Un numero nuevo que envia 200 mensajes el dia 1 sera bloqueado casi seguro.",
      "Necesitas interaccion real: responde mensajes, haz llamadas, usa WhatsApp normalmente.",
    ],
  },
  {
    emoji: "\u{1F500}",
    titulo: "Variacion de Contenido",
    puntos: [
      "Nunca envies el mismo texto identico a todos. Rota entre 3-5 variaciones.",
      "Cada archivo (imagen/PDF) tiene un hash unico. Si envias el mismo archivo 50 veces, WhatsApp lo detecta.",
      "Cambia nombres de archivos, redimensiona imagenes o agrega pequenas variaciones.",
      "Alterna entre mensajes con y sin multimedia.",
    ],
  },
  {
    emoji: "\u{23F1}\u{FE0F}",
    titulo: "Gestion de Tiempos",
    puntos: [
      "Usa intervalos irregulares entre mensajes (no exactamente cada 30 seg).",
      "Descansa 5-10 minutos tras cada bloque de 15-20 mensajes.",
      "Evita enviar en horarios inusuales (madrugada, muy temprano).",
      "Si recibes una advertencia de WhatsApp, deten los envios por 24 horas.",
    ],
  },
  {
    emoji: "\u{1F91D}",
    titulo: "Contacto Guardado",
    puntos: [
      "Los mensajes a contactos guardados tienen menor riesgo de reporte.",
      "Pide a tus clientes que guarden tu numero antes del primer mensaje.",
      "Usa una entrada amigable: 'Hola, soy [nombre] de [empresa], guarde tu contacto'.",
      "La sincronizacion de contactos reduce la tasa de bloqueo significativamente.",
    ],
  },
  {
    emoji: "\u{1F4AC}",
    titulo: "Fomentar Respuesta",
    puntos: [
      "Un chat donde solo tu hablas parece spam. Haz preguntas abiertas.",
      "Ejemplo: '\u00BFLe gustaria conocer mas detalles?' en vez de solo informar.",
      "Las respuestas del cliente validan tu numero ante WhatsApp.",
      "Evita el modelo broadcast unidireccional: busca conversacion real.",
    ],
  },
  {
    emoji: "\u{1F9F9}",
    titulo: "Higiene de Base de Datos",
    puntos: [
      "Verifica que los numeros existan en WhatsApp antes de enviar.",
      "Enviar a numeros inexistentes o dados de baja aumenta tu riesgo.",
      "Limpia tu lista: elimina numeros que nunca responden tras 3 intentos.",
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
    <Dialog open={open} onClose={handleClose} maxWidth="lg">
      <DialogBody className="p-6 pb-3">
        <div className="min-h-[300px] flex flex-col items-center justify-center">
          <span className="text-5xl leading-none mb-3">{slide.emoji}</span>
          <h3 className="text-lg font-bold text-slate-100 text-center mb-4">
            {slide.titulo}
          </h3>
          <ul className="m-0 pl-5 w-full list-disc">
            {slide.puntos.map((p, i) => (
              <li key={i} className="text-sm text-slate-400 mb-1.5">
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Dots + Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveStep((s) => s - 1)}
            disabled={activeStep === 0}
            icon={<ChevronLeft className="w-4 h-4" />}
          >
            Atras
          </Button>

          {/* Dots */}
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === activeStep ? "bg-amber-500" : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleClose}
            >
              Entendido
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveStep((s) => s + 1)}
              iconRight={<ChevronRight className="w-4 h-4" />}
            >
              Siguiente
            </Button>
          )}
        </div>
      </DialogBody>
    </Dialog>
  );
}
