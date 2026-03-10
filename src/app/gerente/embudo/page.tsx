"use client";
import { useEffect, useState } from "react";

interface EtapaData {
  id: number;
  nombre: string;
  color: string;
  tipo: string;
  count: number;
  entradas: number;
  salidaCount: number;
  diasPromedio: number | null;
}

interface Conversion {
  de: string;
  a: string;
  porcentaje: number;
}

interface Salida {
  nombre: string;
  cantidad: number;
}

export default function EmbudoPage() {
  const [etapas, setEtapas] = useState<EtapaData[]>([]);
  const [conversiones, setConversiones] = useState<Conversion[]>([]);
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/gerente/embudo?periodo=${periodo}`)
      .then((r) => r.json())
      .then((data) => {
        setEtapas(data.etapas ?? []);
        setConversiones(data.conversiones ?? []);
        setSalidas(data.salidas ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [periodo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  const avance = etapas.filter((e) => e.tipo === "AVANCE" || e.nombre === "Venta");
  const maxCount = Math.max(...avance.map((e) => e.count), 1);
  const totalSalidas = salidas.reduce((s, x) => s + x.cantidad, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Análisis del Embudo</h1>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="semana">Última semana</option>
          <option value="mes">Este mes</option>
          <option value="trimestre">Trimestre</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Embudo visual con forma de embudo */}
        <div className="bg-card border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Embudo Actual (activos)</h2>
          <div className="space-y-1">
            {avance.map((etapa, i) => {
              const widthPct = Math.max((etapa.count / maxCount) * 100, 15);
              return (
                <div key={etapa.id} className="flex flex-col items-center">
                  <div
                    className="h-12 rounded-lg flex items-center justify-between px-4 transition-all duration-500"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: etapa.color + "30",
                      borderLeft: `4px solid ${etapa.color}`,
                    }}
                  >
                    <span className="text-sm text-white font-medium truncate">{etapa.nombre}</span>
                    <span className="text-sm font-bold text-white ml-2">{etapa.count}</span>
                  </div>
                  {/* Flecha de conversión */}
                  {i < avance.length - 1 && conversiones[i] && (
                    <div className="flex items-center gap-1 py-0.5">
                      <span className="text-[10px] text-slate-500">↓</span>
                      <span className={`text-xs font-semibold ${conversiones[i].porcentaje >= 50 ? "text-green-400" : conversiones[i].porcentaje >= 25 ? "text-amber-400" : "text-red-400"}`}>
                        {conversiones[i].porcentaje}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tiempos promedio por etapa */}
        <div className="bg-card border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Tiempos Promedio por Etapa</h2>
          <div className="space-y-3">
            {avance.filter((e) => e.nombre !== "Venta").map((etapa) => (
              <div key={etapa.id} className="flex items-center justify-between py-2 border-b border-slate-800/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: etapa.color }} />
                  <span className="text-sm text-slate-300">{etapa.nombre}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-500">
                    {etapa.entradas > 0 ? `${etapa.entradas} entradas` : "—"}
                  </span>
                  <span className={`font-semibold ${
                    etapa.diasPromedio !== null && etapa.diasPromedio > 5 ? "text-red-400" : "text-white"
                  }`}>
                    {etapa.diasPromedio !== null ? `${etapa.diasPromedio} días` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Conversiones detalladas */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Conversión entre Etapas</h3>
            <div className="space-y-2">
              {conversiones.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{c.de} → {c.a}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${c.porcentaje >= 50 ? "bg-green-500" : c.porcentaje >= 25 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(c.porcentaje, 100)}%` }}
                      />
                    </div>
                    <span className="text-white font-semibold w-12 text-right">{c.porcentaje}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desglose de salidas */}
      {salidas.length > 0 && (
        <div className="bg-card border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">
            Desglose de Salidas
            <span className="text-sm text-slate-500 ml-2 font-normal">({totalSalidas} total)</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {salidas.map((s) => {
              const pct = totalSalidas > 0 ? Math.round((s.cantidad / totalSalidas) * 100) : 0;
              return (
                <div key={s.nombre} className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{s.cantidad}</p>
                  <p className="text-xs text-slate-400 mt-1">{s.nombre}</p>
                  <p className="text-xs text-slate-600">{pct}% de salidas</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
