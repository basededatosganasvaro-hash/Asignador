"use client";
import { useEffect, useState, useCallback } from "react";
import { Save, RotateCcw, Sparkles, Pencil, AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { WA_MENSAJES_DEFAULT, WA_ETAPAS_ORDEN } from "@/lib/whatsapp";

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const ETAPA_COLORES: Record<string, string> = {
  Asignado: "#42A5F5",
  Contactado: "#FFA726",
  Interesado: "#AB47BC",
  "Negociacion": "#66BB6A",
  Capturados: "#26C6DA",
  Capacidades: "#4caf50",
};

const ETAPA_DESCRIPCIONES: Record<string, string> = {
  Asignado: "Primer contacto con el cliente asignado del pool",
  Contactado: "Seguimiento tras el primer contacto exitoso",
  Interesado: "El cliente mostro interes, avanzar con tramite",
  "Negociacion": "Compartir propuesta y cerrar la venta",
  Capturados: "Clientes captados por ti directamente",
  Capacidades: "Clientes con capacidad IMSS consultada por Telegram",
};

const IA_LIMIT = 10;

const PALABRAS_RIESGO = ["prestamo", "préstamo", "credito", "crédito"];

function detectaPalabrasRiesgo(texto: string): boolean {
  const lower = texto.toLowerCase();
  return PALABRAS_RIESGO.some((p) => lower.includes(p));
}

export default function ConfiguracionPage() {
  const [plantillas, setPlantillas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal de edicion
  const [editingEtapa, setEditingEtapa] = useState<string | null>(null);
  const [editingMsg, setEditingMsg] = useState("");
  const [iaUsadas, setIaUsadas] = useState(0);
  const [iaLoading, setIaLoading] = useState(false);

  const { toast } = useToast();

  const fetchPlantillas = useCallback(async () => {
    try {
      const res = await fetch("/api/promotor/plantillas-whatsapp");
      if (res.ok) {
        setPlantillas(await res.json());
      } else {
        setPlantillas({ ...WA_MENSAJES_DEFAULT });
      }
    } catch {
      setPlantillas({ ...WA_MENSAJES_DEFAULT });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlantillas(); }, [fetchPlantillas]);

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
        toast("Plantillas guardadas correctamente", "success");
      } else {
        const data = await res.json();
        toast(data.error || "Error al guardar", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setSaving(false);
  };

  // ── Modal handlers ──────────────────────────────────────────────────────────

  const handleOpenEdit = (etapa: string) => {
    setEditingEtapa(etapa);
    setEditingMsg(plantillas[etapa] || WA_MENSAJES_DEFAULT[etapa] || "");
  };

  const handleCloseEdit = () => {
    setEditingEtapa(null);
    setEditingMsg("");
  };

  const handleApplyEdit = () => {
    if (editingEtapa) {
      setPlantillas((prev) => ({ ...prev, [editingEtapa]: editingMsg }));
    }
    handleCloseEdit();
  };

  const handleResetInModal = () => {
    if (editingEtapa) {
      setEditingMsg(WA_MENSAJES_DEFAULT[editingEtapa] || "");
    }
  };

  const savePlantillas = useCallback(async (updated: Record<string, string>) => {
    try {
      await fetch("/api/promotor/plantillas-whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch { /* silencioso — el usuario puede guardar manualmente */ }
  }, []);

  const handleMejorarIA = async () => {
    if (iaUsadas >= IA_LIMIT || !editingMsg.trim() || !editingEtapa) return;
    setIaLoading(true);
    try {
      const res = await fetch("/api/whatsapp/variaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje_base: editingMsg, cantidad: 1, modo: "mejorar" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.variaciones?.[0]) {
          const mejorado = data.variaciones[0];
          setEditingMsg(mejorado);
          // Auto-aplicar a plantillas y guardar en BD
          const updated = { ...plantillas, [editingEtapa]: mejorado };
          setPlantillas(updated);
          savePlantillas(updated);
          setIaUsadas((prev) => prev + 1);
          toast("Mensaje mejorado y guardado", "success");
        }
      } else {
        const errData = await res.json();
        toast(errData.error || "Error al mejorar mensaje", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setIaLoading(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center mt-16">
        <Spinner />
      </div>
    );
  }

  const iaRestantes = IA_LIMIT - iaUsadas;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
            <h1 className="text-xl font-semibold text-slate-100">Mensajes de WhatsApp</h1>
          </div>
          <p className="text-sm text-slate-500">
            Toca una tarjeta para editar el mensaje de cada etapa
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Contador IA */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-medium text-purple-300">
              {iaRestantes}/{IA_LIMIT} mejoras IA
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleResetAll}
          >
            Restaurar todos
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Save className="w-4 h-4" />}
            onClick={handleSave}
            loading={saving}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {/* Info de variables */}
      <Alert variant="info" className="mb-6">
        <p className="font-semibold text-sm mb-1">Variables disponibles:</p>
        <p className="text-sm">
          <strong>{"{nombre}"}</strong> — Primer nombre del cliente &nbsp;&nbsp;|&nbsp;&nbsp;
          <strong>{"{promotor}"}</strong> — Tu nombre
        </p>
      </Alert>

      {/* Cards por etapa — solo lectura, clickeables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {WA_ETAPAS_ORDEN.map((etapa) => {
          const mensaje = plantillas[etapa] || WA_MENSAJES_DEFAULT[etapa] || "";
          const isDefault = mensaje === WA_MENSAJES_DEFAULT[etapa];

          return (
            <button
              key={etapa}
              type="button"
              onClick={() => handleOpenEdit(etapa)}
              className="bg-surface rounded-xl border border-slate-800/60 overflow-hidden text-left transition-all hover:border-slate-600 hover:bg-slate-800/30 group"
              style={{ borderLeftWidth: 4, borderLeftColor: ETAPA_COLORES[etapa] || "#94a3b8" }}
            >
              <div className="p-5">
                {/* Etapa badge + edit icon */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: ETAPA_COLORES[etapa] || "#94a3b8" }}
                    >
                      {etapa}
                    </span>
                    <span className="text-xs text-slate-500">
                      {ETAPA_DESCRIPCIONES[etapa]}
                    </span>
                  </div>
                  <Pencil className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </div>

                {/* Mensaje preview */}
                <div className="flex items-start gap-2">
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366] mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
                    {mensaje}
                  </p>
                </div>

                {/* Indicador personalizado */}
                {!isDefault && (
                  <div className="mt-2 flex justify-end">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Personalizado
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Modal de edicion ──────────────────────────────────────────────────── */}
      <Dialog open={!!editingEtapa} onClose={handleCloseEdit} maxWidth="lg">
        <DialogHeader onClose={handleCloseEdit}>
          <div className="flex items-center gap-2">
            {editingEtapa && (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: ETAPA_COLORES[editingEtapa] || "#94a3b8" }}
              >
                {editingEtapa}
              </span>
            )}
            <span>Editar mensaje</span>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-4">
            {/* Descripcion de la etapa */}
            {editingEtapa && (
              <p className="text-sm text-slate-400">
                {ETAPA_DESCRIPCIONES[editingEtapa]}
              </p>
            )}

            {/* Textarea */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Mensaje
              </label>
              <textarea
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 outline-none transition-all resize-none"
                rows={5}
                value={editingMsg}
                onChange={(e) => setEditingMsg(e.target.value)}
                placeholder="Escribe tu mensaje..."
              />
            </div>

            {/* Alerta palabras de riesgo */}
            {detectaPalabrasRiesgo(editingMsg) && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-400">Palabras de riesgo detectadas</p>
                  <p className="text-xs text-red-300/80 mt-0.5">
                    Las palabras <strong>&quot;prestamo&quot;</strong> y <strong>&quot;credito&quot;</strong> aumentan
                    la posibilidad de bloqueo en WhatsApp. Usa alternativas como
                    &quot;beneficio&quot;, &quot;apoyo financiero&quot; u &quot;oportunidad&quot;.
                  </p>
                </div>
              </div>
            )}

            {/* Boton IA + contador */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                icon={<Sparkles className="w-4 h-4" />}
                onClick={handleMejorarIA}
                disabled={iaLoading || iaUsadas >= IA_LIMIT || !editingMsg.trim()}
                loading={iaLoading}
                className="!bg-purple-600 !text-white hover:!bg-purple-500 !shadow-lg !shadow-purple-600/20"
              >
                {iaLoading ? "Mejorando..." : "Mejorar con IA"}
              </Button>
              <span className={`text-xs ${iaRestantes > 0 ? "text-purple-400" : "text-red-400"}`}>
                {iaRestantes > 0
                  ? `${iaRestantes} mejora${iaRestantes !== 1 ? "s" : ""} restante${iaRestantes !== 1 ? "s" : ""}`
                  : "Limite de mejoras alcanzado"
                }
              </span>
            </div>

            {/* Variables hint */}
            <div className="text-xs text-slate-500 bg-slate-800/30 rounded-lg px-3 py-2">
              Variables: <code className="text-amber-400">{"{nombre}"}</code> = nombre del cliente, <code className="text-amber-400">{"{promotor}"}</code> = tu nombre
            </div>

            {/* Preview */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800/40">
              <div className="flex items-start gap-2">
                <WhatsAppIcon className="w-4 h-4 text-[#25D366] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Vista previa:</p>
                  <p className="text-sm text-slate-400 italic leading-relaxed">
                    {editingMsg
                      .replace(/\{nombre\}/g, "Carlos Perez Lopez")
                      .replace(/\{promotor\}/g, "Juan Perez")
                    || "\u2014"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleResetInModal}
          >
            Restaurar original
          </Button>
          <div className="flex-1" />
          <Button variant="danger" size="sm" onClick={handleCloseEdit}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleApplyEdit}>
            Aplicar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
