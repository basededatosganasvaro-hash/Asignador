"use client";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ActividadHoy {
  id: number;
  nombre: string;
  asignaciones: number;
  transiciones: number;
  llamadas: number;
  whatsapp: number;
  sms: number;
  notas: number;
  total: number;
  horasSinActividad: number | null;
  sinActividad: boolean;
}

interface ResumenSemanal {
  tipo: string;
  cantidad: number;
}

interface HeatmapItem {
  usuario_id: number;
  dia: string;
  cantidad: number;
}

export default function ActividadPage() {
  const [hoy, setHoy] = useState<ActividadHoy[]>([]);
  const [resumenSemanal, setResumenSemanal] = useState<ResumenSemanal[]>([]);
  const [semanal, setSemanal] = useState<HeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gerente/actividad")
      .then((r) => r.json())
      .then((data) => {
        setHoy(data.hoy ?? []);
        setResumenSemanal(data.resumenSemanal ?? []);
        setSemanal(data.semanal ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  const sinActividad = hoy.filter((p) => p.sinActividad);
  const conActividad = [...hoy].sort((a, b) => b.total - a.total);

  // Heatmap: últimos 7 días
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  const promotorIds = [...new Set(hoy.map((h) => h.id))];
  const heatmapMap = new Map<string, number>();
  for (const item of semanal) {
    const diaKey = new Date(item.dia).toISOString().split("T")[0];
    heatmapMap.set(`${item.usuario_id}-${diaKey}`, item.cantidad);
  }
  const maxHeatmap = Math.max(...Array.from(heatmapMap.values()), 1);

  const tipoLabels: Record<string, string> = {
    CAMBIO_ETAPA: "Transiciones",
    NOTA: "Notas",
    LLAMADA: "Llamadas",
    WHATSAPP: "WhatsApp",
    SMS: "SMS",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Monitor de Actividad</h1>

      {/* Alerta de inactividad */}
      {sinActividad.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-400 font-semibold text-sm">
              {sinActividad.length} promotor{sinActividad.length > 1 ? "es" : ""} sin actividad hoy
            </p>
            <p className="text-red-300 text-sm mt-1">
              {sinActividad.map((p) => {
                const horas = p.horasSinActividad;
                const label = horas !== null
                  ? horas >= 24 ? `${Math.floor(horas / 24)}d` : `${Math.round(horas)}h`
                  : "nunca";
                return `${p.nombre} (última: ${label})`;
              }).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Resumen semanal por tipo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {resumenSemanal.map((r) => (
          <div key={r.tipo} className="bg-card border border-slate-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-white">{r.cantidad}</p>
            <p className="text-xs text-slate-500">{tipoLabels[r.tipo] ?? r.tipo}</p>
            <p className="text-[10px] text-slate-600">esta semana</p>
          </div>
        ))}
      </div>

      {/* Tabla de actividad de hoy */}
      <div className="bg-card border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Actividad de Hoy</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
                <th className="px-3 py-3 text-left">Promotor</th>
                <th className="px-3 py-3 text-right">Asignaciones</th>
                <th className="px-3 py-3 text-right">Transiciones</th>
                <th className="px-3 py-3 text-right">Llamadas</th>
                <th className="px-3 py-3 text-right">WhatsApp</th>
                <th className="px-3 py-3 text-right">Notas</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {conActividad.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-slate-800/50 ${
                    p.sinActividad ? "bg-red-500/5" : i % 2 === 0 ? "bg-slate-900/30" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">
                    {p.nombre}
                    {p.sinActividad && <span className="ml-2 text-red-400 text-xs">(inactivo)</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{p.asignaciones || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{p.transiciones || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{p.llamadas || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{p.whatsapp || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{p.notas || "—"}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${p.total > 0 ? "text-white" : "text-red-400"}`}>
                    {p.total}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-500 text-xs">
                    {p.horasSinActividad !== null
                      ? p.horasSinActividad < 1 ? "hace minutos"
                        : p.horasSinActividad < 24 ? `hace ${Math.round(p.horasSinActividad)}h`
                        : `hace ${Math.floor(p.horasSinActividad / 24)}d`
                      : "sin registro"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap semanal */}
      {promotorIds.length > 0 && (
        <div className="bg-card border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Actividad Semanal (heatmap)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-slate-500 pb-2 pr-3">Promotor</th>
                  {dias.map((d) => (
                    <th key={d.toISOString()} className="text-center text-slate-500 pb-2 px-1 min-w-[40px]">
                      {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d.getDay()]}
                      <br />
                      <span className="text-slate-600">{d.getDate()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hoy.map((p) => (
                  <tr key={p.id}>
                    <td className="text-slate-300 py-1 pr-3 whitespace-nowrap">{p.nombre}</td>
                    {dias.map((d) => {
                      const key = `${p.id}-${d.toISOString().split("T")[0]}`;
                      const val = heatmapMap.get(key) ?? 0;
                      const intensity = val > 0 ? Math.max(0.15, val / maxHeatmap) : 0;
                      return (
                        <td key={key} className="px-1 py-1 text-center">
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center mx-auto text-xs font-medium"
                            style={{
                              backgroundColor: val > 0 ? `rgba(34, 197, 94, ${intensity})` : "rgb(30, 41, 59)",
                              color: val > 0 ? "white" : "rgb(71, 85, 105)",
                            }}
                          >
                            {val || "·"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
