"use client";
import { useState, useEffect, useCallback } from "react";
import { Pause, Play, XCircle, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { LinearProgress } from "@/components/ui/LinearProgress";

interface Campana {
  id: number;
  nombre: string;
  estado: string;
  total_mensajes: number;
  enviados: number;
  entregados: number;
  leidos: number;
  fallidos: number;
  created_at: string;
}

const ESTADO_BADGE: Record<string, "slate" | "orange" | "blue" | "red" | "green" | "amber"> = {
  CREADA: "slate",
  EN_COLA: "orange",
  ENVIANDO: "blue",
  PAUSADA: "amber",
  COMPLETADA: "green",
  CANCELADA: "red",
};

export default function CampanaProgreso() {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchCampanas = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/campanas");
      if (res.ok) setCampanas(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCampanas();
    const interval = setInterval(fetchCampanas, 10000);
    return () => clearInterval(interval);
  }, [fetchCampanas]);

  const handleAction = async (campanaId: number, action: "pause" | "resume" | "cancel") => {
    try {
      await fetch(`/api/whatsapp/campanas/${campanaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchCampanas();
    } catch { /* ignore */ }
  };

  if (campanas.length === 0) return null;

  return (
    <div className="bg-surface rounded-xl border border-slate-800/60 p-4 mb-3">
      <h3 className="text-sm font-bold text-slate-100 mb-3">Campañas WhatsApp</h3>
      <div className="space-y-2">
        {campanas.map((c) => {
          const pct = c.total_mensajes > 0 ? Math.round((c.enviados / c.total_mensajes) * 100) : 0;
          const isActive = ["EN_COLA", "ENVIANDO"].includes(c.estado);

          return (
            <div key={c.id}>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200 truncate flex-1">{c.nombre}</span>
                    <Badge color={ESTADO_BADGE[c.estado] ?? "slate"}>{c.estado}</Badge>
                  </div>
                  <div className="mt-1">
                    <LinearProgress value={pct} color={isActive ? "green" : "blue"} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-slate-400">{c.enviados}/{c.total_mensajes} enviados</span>
                    {c.entregados > 0 && (
                      <span className="text-xs text-green-400 flex items-center gap-0.5">
                        <CheckCircle className="w-2.5 h-2.5" />{c.entregados} entregados
                      </span>
                    )}
                    {c.leidos > 0 && (
                      <span className="text-xs text-blue-400">{c.leidos} leídos</span>
                    )}
                    {c.fallidos > 0 && (
                      <span className="text-xs text-red-400 flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" />{c.fallidos} fallidos
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-0.5 shrink-0">
                  {c.estado === "ENVIANDO" && (
                    <Tooltip content="Pausar">
                      <button onClick={() => handleAction(c.id, "pause")} className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg transition-colors">
                        <Pause className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}
                  {c.estado === "PAUSADA" && (
                    <Tooltip content="Reanudar">
                      <button onClick={() => handleAction(c.id, "resume")} className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors">
                        <Play className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}
                  {isActive && (
                    <Tooltip content="Cancelar">
                      <button onClick={() => handleAction(c.id, "cancel")} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}
                  <button
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-colors"
                  >
                    {expanded === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expanded === c.id && (
                <div className="mt-2 animate-[fadeIn_150ms_ease-out]">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Enviados", value: c.enviados, bg: "bg-blue-500/10", text: "text-blue-400", always: true },
                      { label: "Entregados", value: c.entregados, bg: "bg-green-500/10", text: "text-green-400", always: false },
                      { label: "Leídos", value: c.leidos, bg: "bg-teal-500/10", text: "text-teal-400", always: false },
                      { label: "Fallidos", value: c.fallidos, bg: "bg-red-500/10", text: "text-red-400", always: false },
                    ]
                      .filter((s) => s.always || s.value > 0)
                      .map((s) => (
                        <div key={s.label} className={`flex-1 min-w-[70px] text-center rounded-xl py-2 px-1 ${s.bg}`}>
                          <span className={`block text-xl font-bold ${s.text} leading-tight`}>{s.value}</span>
                          <span className={`text-[10px] font-semibold ${s.text}`}>{s.label}</span>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Creada: {new Date(c.created_at).toLocaleString("es-MX")}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
