"use client";
import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Users, AlertTriangle, DollarSign, Target } from "lucide-react";

interface KPIs {
  oportunidadesActivas: number;
  ventasMes: number;
  montoMes: number;
  conversionGlobal: number;
  timersVencidosMes: number;
  promotoresActivos: number;
  totalPromotores: number;
  cupoPromedio: number;
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

export default function GerenteDashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [embudo, setEmbudo] = useState<EmbudoItem[]>([]);
  const [tendencia, setTendencia] = useState<TendenciaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gerente/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setKpis(data.kpis);
        setEmbudo(data.embudo);
        setTendencia(data.tendencia);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!kpis) return <p className="text-slate-400">Error al cargar datos</p>;

  const maxEmbudo = Math.max(...embudo.map((e) => e.count), 1);
  const maxTendencia = Math.max(...tendencia.map((t) => t.cantidad), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Oportunidades Activas"
          value={kpis.oportunidadesActivas.toLocaleString()}
          icon={<Target className="w-5 h-5" />}
          color="text-blue-400"
        />
        <KpiCard
          label="Ventas del Mes"
          value={kpis.ventasMes.toString()}
          sub={`$${kpis.montoMes.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="text-green-400"
        />
        <KpiCard
          label="Conversión Global"
          value={`${kpis.conversionGlobal}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="text-amber-400"
        />
        <KpiCard
          label="Timers Vencidos"
          value={kpis.timersVencidosMes.toString()}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={kpis.timersVencidosMes > 10 ? "text-red-400" : "text-slate-400"}
        />
        <KpiCard
          label="Promotores Activos"
          value={`${kpis.promotoresActivos}/${kpis.totalPromotores}`}
          icon={<Users className="w-5 h-5" />}
          color="text-purple-400"
        />
        <KpiCard
          label="Uso de Cupo Promedio"
          value={`${kpis.cupoPromedio}%`}
          icon={<BarChart3 className="w-5 h-5" />}
          color="text-cyan-400"
        />
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

          {/* Etapas de salida */}
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

function KpiCard({ label, value, sub, icon, color }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-card border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
