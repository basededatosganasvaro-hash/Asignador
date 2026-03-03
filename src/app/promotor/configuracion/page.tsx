"use client";
import { useEffect, useState, useCallback } from "react";
import { Save, RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
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
};

const ETAPA_DESCRIPCIONES: Record<string, string> = {
  Asignado: "Primer contacto con el cliente asignado del pool",
  Contactado: "Seguimiento tras el primer contacto exitoso",
  Interesado: "El cliente mostro interes, avanzar con tramite",
  "Negociacion": "Compartir propuesta y cerrar la venta",
  Capturados: "Clientes captados por ti directamente",
};

export default function ConfiguracionPage() {
  const [plantillas, setPlantillas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPlantillas = useCallback(async () => {
    try {
      const res = await fetch("/api/promotor/plantillas-whatsapp");
      if (res.ok) {
        setPlantillas(await res.json());
      } else {
        // Si la API falla (ej: tabla no existe aun), usar defaults
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

  if (loading) {
    return (
      <div className="flex justify-center mt-16">
        <Spinner />
      </div>
    );
  }

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
            Personaliza el mensaje que se enviara a tus clientes en cada etapa del embudo
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Plantillas por etapa */}
      <div className="flex flex-col gap-5">
        {WA_ETAPAS_ORDEN.map((etapa) => (
          <div
            key={etapa}
            className="bg-surface rounded-xl border border-slate-800/60 overflow-hidden"
            style={{ borderLeftWidth: 4, borderLeftColor: ETAPA_COLORES[etapa] || "#94a3b8" }}
          >
            <div className="p-5 pb-4">
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
                <button
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => handleReset(etapa)}
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar
                </button>
              </div>

              <textarea
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 outline-none transition-all resize-none"
                rows={3}
                value={plantillas[etapa] || ""}
                onChange={(e) => handleChange(etapa, e.target.value)}
                placeholder={WA_MENSAJES_DEFAULT[etapa]}
              />

              <Divider />

              {/* Preview */}
              <div className="flex items-start gap-2">
                <WhatsAppIcon className="w-4 h-4 text-[#25D366] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    Vista previa:
                  </p>
                  <p className="text-[13px] text-slate-500 italic">
                    {(plantillas[etapa] || "")
                      .replace(/\{nombre\}/g, "Carlos Perez Lopez")
                      .replace(/\{promotor\}/g, "Juan Perez")
                    || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
