"use client";
import { useState, useEffect } from "react";
import { Sparkles, Send, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";

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

  useEffect(() => { setMensajeBase(mensajeInicial); }, [mensajeInicial]);

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
    if (activeStep === 2) return true;
    return true;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md">
      <DialogHeader onClose={handleClose}>
        <div>
          <span className="text-lg font-bold text-slate-100">Crear Campaña WhatsApp</span>
          {/* Stepper */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-2 ${i <= activeStep ? "text-amber-400" : "text-slate-500"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i < activeStep ? "bg-amber-500 text-white" :
                    i === activeStep ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40" :
                    "bg-slate-800 text-slate-500 ring-1 ring-slate-700"
                  }`}>
                    {i < activeStep ? "✓" : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-1 ${i < activeStep ? "bg-amber-500/40" : "bg-slate-700"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogHeader>

      <DialogBody className="min-h-[300px]">
        {error && <Alert variant="error" className="mb-3">{error}</Alert>}

        {/* Step 0: Destinatarios */}
        {activeStep === 0 && (
          <div>
            <p className="text-sm text-slate-400 mb-3">
              Se enviarán mensajes a {destinatarios.length} cliente{destinatarios.length !== 1 ? "s" : ""} seleccionados.
            </p>
            <Input
              label="Nombre de la campaña (opcional)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={`Campaña ${new Date().toLocaleDateString("es-MX")}`}
            />
            <div className="mt-3 border border-slate-700/60 rounded-xl max-h-[200px] overflow-auto">
              <ul className="divide-y divide-slate-800/60">
                {destinatarios.slice(0, 20).map((d, i) => (
                  <li key={i} className="px-3 py-2">
                    <span className="text-sm text-slate-200">{d.nombre_cliente}</span>
                    <span className="block text-xs text-slate-500">{d.numero_destino}</span>
                  </li>
                ))}
                {destinatarios.length > 20 && (
                  <li className="px-3 py-2 text-xs text-slate-500">
                    ... y {destinatarios.length - 20} más
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Step 1: Mensaje */}
        {activeStep === 1 && (
          <div>
            <p className="text-sm text-slate-400 mb-2">
              Escribe el mensaje base. Usa <strong className="text-slate-200">{"{nombre}"}</strong> para insertar el nombre del cliente.
            </p>
            <textarea
              className="w-full rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-sm text-slate-100
                placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40
                resize-none transition-colors"
              rows={6}
              value={mensajeBase}
              onChange={(e) => setMensajeBase(e.target.value)}
              placeholder="Hola {nombre}, le saludo de parte de..."
            />
            <p className="text-xs text-slate-500 mt-1">{mensajeBase.length} caracteres</p>
          </div>
        )}

        {/* Step 2: Variaciones IA */}
        {activeStep === 2 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-sm text-slate-400 flex-1">
                Genera variaciones con IA para evitar detección de spam. Cada destinatario recibirá una variación diferente.
              </p>
              <Button
                size="sm"
                icon={generandoIA ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                onClick={handleGenerarVariaciones}
                disabled={generandoIA || !mensajeBase.trim()}
              >
                {generandoIA ? "Generando..." : variaciones.length > 0 ? "Regenerar" : "Generar"}
              </Button>
            </div>

            {variaciones.length > 0 && (
              <>
                <Badge color="green" className="mb-2">{variaciones.length} variaciones</Badge>
                <div className="border border-slate-700/60 rounded-xl max-h-[300px] overflow-auto">
                  <ul className="divide-y divide-slate-800/60">
                    {variaciones.map((v, i) => (
                      <li key={i} className="px-3 py-2 flex items-start gap-2">
                        {editIdx === i ? (
                          <div className="flex gap-2 w-full">
                            <textarea
                              className="flex-1 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs text-slate-100
                                focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={2}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                setVariaciones((prev) => prev.map((val, j) => j === i ? editText : val));
                                setEditIdx(null);
                              }}
                            >
                              OK
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-semibold text-slate-500">#{i + 1}</span>
                              <p className="text-xs text-slate-300 mt-0.5">{v}</p>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <button
                                onClick={() => { setEditIdx(i); setEditText(v); }}
                                className="p-1 text-slate-500 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setVariaciones((prev) => prev.filter((_, j) => j !== i))}
                                className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {variaciones.length === 0 && !generandoIA && (
              <Alert variant="info" className="mt-3">
                Puedes omitir este paso. Sin variaciones, todos los destinatarios recibirán el mismo mensaje.
              </Alert>
            )}
          </div>
        )}

        {/* Step 3: Confirmar */}
        {activeStep === 3 && (
          <div>
            <h3 className="text-sm font-bold text-slate-100 mb-3">Resumen de la campaña</h3>
            <div className="border border-slate-700/60 rounded-xl p-4 space-y-2">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <span className="text-slate-400">Nombre:</span>
                <span className="font-semibold text-slate-200">{nombre || `Campaña ${new Date().toLocaleDateString("es-MX")}`}</span>
                <span className="text-slate-400">Destinatarios:</span>
                <span className="font-semibold text-slate-200">{destinatarios.length}</span>
                <span className="text-slate-400">Variaciones IA:</span>
                <span className="font-semibold text-slate-200">{variaciones.length > 0 ? `${variaciones.length} variaciones` : "Sin variaciones"}</span>
              </div>
            </div>

            <Alert variant="warning" className="mt-3">
              Los mensajes se enviarán con delays aleatorios (8-25s) para evitar bloqueos.
              Límite diario: 180 mensajes. La campaña puede pausarse si se alcanza el límite.
            </Alert>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <div className="flex justify-between w-full">
          <Button variant="danger" onClick={handleClose}>Cancelar</Button>
          <div className="flex gap-2">
            {activeStep > 0 && (
              <Button variant="secondary" onClick={() => setActiveStep((s) => s - 1)}>Atrás</Button>
            )}
            {activeStep < STEPS.length - 1 ? (
              <Button onClick={() => setActiveStep((s) => s + 1)} disabled={!canNext()}>
                Siguiente
              </Button>
            ) : (
              <Button
                onClick={handleLanzar}
                icon={enviando ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                disabled={enviando}
              >
                {enviando ? "Creando..." : "Iniciar Envío"}
              </Button>
            )}
          </div>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
