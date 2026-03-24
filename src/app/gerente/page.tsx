"use client";
import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import StatCard from "@/components/ui/StatCard";
import {
  Users, TrendingUp, Target, DollarSign, AlertTriangle, Filter,
} from "lucide-react";

interface Etapa {
  id: number;
  nombre: string;
  color: string;
  tipo: string;
}

interface PromotorData {
  id: number;
  nombre: string;
  equipo: string | null;
  porEtapa: Record<number, number>;
  total: number;
}

interface Equipo {
  id: number;
  nombre: string;
  sucursal: { nombre: string } | null;
}

interface KPIs {
  promotoresActivos: number;
  oportunidadesActivas: number;
  ventasMes: number;
  montoMes: number;
  conversionGlobal: number;
  timersVencidosMes: number;
}

interface EmbudoItem {
  id: number;
  nombre: string;
  color: string;
  tipo: string;
  count: number;
}

interface TendenciaItem {
  semana: string;
  cantidad: number;
  monto: number;
}

interface DashboardData {
  equipos: Equipo[];
  etapas: Etapa[];
  promotores: PromotorData[];
  totales: Record<number, number>;
  totalGeneral: number;
  kpis: KPIs;
  embudo: EmbudoItem[];
  tendencia: TendenciaItem[];
}

const etapaColorMap: Record<string, "amber" | "green" | "red" | "blue" | "purple" | "yellow" | "teal" | "orange" | "slate" | "emerald"> = {
  "#ff9800": "orange",
  "#f44336": "red",
  "#4caf50": "green",
  "#2196f3": "blue",
  "#9c27b0": "purple",
  "#ffeb3b": "yellow",
  "#009688": "teal",
  "#ff5722": "orange",
  "#607080": "slate",
  "#4caf4f": "emerald",
  "#1565c0": "blue",
  "#66bb6a": "green",
  "#ef9a9a": "red",
  "#ef5350": "red",
  "#b71c1c": "red",
  "#9e9e9e": "slate",
};

function getEtapaBadgeColor(hex: string) {
  return etapaColorMap[hex?.toLowerCase()] ?? "slate";
}

export default function GerenteDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipoId, setEquipoId] = useState<string>("");

  const fetchData = useCallback(async (eqId: string) => {
    setLoading(true);
    try {
      const url = eqId
        ? `/api/gerente/dashboard?equipo_id=${eqId}`
        : "/api/gerente/dashboard";
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(equipoId); }, [fetchData, equipoId]);

  if (loading && !data) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>;
  if (!data) return <div className="text-center mt-20"><span className="text-sm text-slate-400">Error al cargar dashboard</span></div>;

  const { kpis, embudo, tendencia } = data;
  const maxEmbudo = Math.max(...embudo.map((e) => e.count), 1);
  const maxTendencia = Math.max(...tendencia.map((t) => t.cantidad), 1);

  return (
    <div className="space-y-6">
      {/* Header + Filtro */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">Dashboard</h1>
          <span className="text-sm text-slate-400">Resumen de tu región</span>
        </div>
        {data.equipos.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={equipoId}
              onChange={(e) => setEquipoId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="">Todos los equipos</option>
              {data.equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nombre}{eq.sucursal ? ` — ${eq.sucursal.nombre}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Promotores Activos"
          value={kpis.promotoresActivos}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Oportunidades Activas"
          value={kpis.oportunidadesActivas}
          icon={<Target className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Ventas del Mes"
          value={kpis.ventasMes}
          subtitle={`$${kpis.montoMes.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Conversión Global"
          value={`${kpis.conversionGlobal}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          title="Timers Vencidos"
          value={kpis.timersVencidosMes}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={kpis.timersVencidosMes > 10 ? "red" : "slate"}
        />
      </div>

      {/* Tabla promotores x etapas (estilo supervisor) */}
      <div className="bg-surface rounded-xl border border-slate-800/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 sticky left-0 bg-slate-800/40 z-10 min-w-[180px]">
                  Promotor
                </th>
                {!equipoId && (
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 min-w-[120px]">
                    Equipo
                  </th>
                )}
                {data.etapas.map((e) => (
                  <th key={e.id} className="text-center px-3 py-3 min-w-[90px]">
                    <Badge color={getEtapaBadgeColor(e.color)} className="text-[10px]">
                      {e.nombre}
                    </Badge>
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-200">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {data.promotores.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-sm text-slate-200 font-medium sticky left-0 bg-surface z-10">
                    {p.nombre}
                  </td>
                  {!equipoId && (
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {p.equipo ?? "—"}
                    </td>
                  )}
                  {data.etapas.map((e) => (
                    <td key={e.id} className="text-center px-3 py-2.5">
                      <span className={`text-sm ${(p.porEtapa[e.id] || 0) > 0 ? "text-slate-200 font-semibold" : "text-slate-600"}`}>
                        {p.porEtapa[e.id] || 0}
                      </span>
                    </td>
                  ))}
                  <td className="text-center px-4 py-2.5">
                    <span className="text-sm font-bold text-amber-400">{p.total}</span>
                  </td>
                </tr>
              ))}

              {/* Fila TOTAL */}
              <tr className="bg-slate-800/20 border-t-2 border-slate-700">
                <td className="px-4 py-2.5 text-sm font-bold text-slate-100 sticky left-0 bg-slate-800/20 z-10">
                  TOTAL
                </td>
                {!equipoId && <td />}
                {data.etapas.map((e) => (
                  <td key={e.id} className="text-center px-3 py-2.5">
                    <span className="text-sm font-bold text-slate-200">
                      {data.totales[e.id] || 0}
                    </span>
                  </td>
                ))}
                <td className="text-center px-4 py-2.5">
                  <span className="text-sm font-bold text-amber-300">{data.totalGeneral}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Embudo + Tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Embudo visual */}
        <div className="bg-card border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Embudo de Ventas</h2>
          <div className="space-y-3">
            {embudo.filter((e) => e.tipo === "AVANCE" || e.nombre === "Venta").map((etapa) => (
              <div key={etapa.id} className="flex items-center gap-3">
                <span className="text-sm text-slate-400 w-28 truncate">{etapa.nombre}</span>
                <div className="flex-1 h-8 bg-slate-800 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-500"
                    style={{
                      width: `${Math.max((etapa.count / maxEmbudo) * 100, 2)}%`,
                      backgroundColor: etapa.color,
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white">
                    {etapa.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Salidas</p>
            <div className="flex flex-wrap gap-2">
              {embudo.filter((e) => e.tipo === "SALIDA" || (e.tipo === "FINAL" && e.nombre !== "Venta")).map((etapa) => (
                <span
                  key={etapa.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ backgroundColor: etapa.color + "20", color: etapa.color }}
                >
                  {etapa.nombre}: {etapa.count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tendencia semanal */}
        <div className="bg-card border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Ventas por Semana</h2>
          {tendencia.length === 0 ? (
            <p className="text-slate-500 text-sm">Sin datos de ventas en las últimas 8 semanas</p>
          ) : (
            <div className="space-y-2">
              {tendencia.map((t, i) => {
                const fecha = new Date(t.semana);
                const label = `${fecha.getDate()}/${fecha.getMonth() + 1}`;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-12">{label}</span>
                    <div className="flex-1 h-7 bg-slate-800 rounded-lg overflow-hidden relative">
                      <div
                        className="h-full bg-green-500/70 rounded-lg transition-all duration-500"
                        style={{ width: `${Math.max((t.cantidad / maxTendencia) * 100, 3)}%` }}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white">
                        {t.cantidad} — ${t.monto.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
