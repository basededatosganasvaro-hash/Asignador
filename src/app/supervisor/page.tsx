"use client";
import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import StatCard from "@/components/ui/StatCard";
import { Users, TrendingUp } from "lucide-react";

interface Etapa {
  id: number;
  nombre: string;
  color: string;
  tipo: string;
}

interface PromotorData {
  id: number;
  nombre: string;
  porEtapa: Record<number, number>;
  total: number;
}

interface DashboardData {
  etapas: Etapa[];
  promotores: PromotorData[];
  totales: Record<number, number>;
  totalGeneral: number;
  promotoresActivos: number;
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
};

function getEtapaBadgeColor(hex: string) {
  return etapaColorMap[hex?.toLowerCase()] ?? "slate";
}

export default function SupervisorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/supervisor/dashboard");
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>;
  if (!data) return <div className="text-center mt-20"><span className="text-sm text-slate-400">Error al cargar dashboard</span></div>;

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-slate-100 mb-1">Dashboard</h1>
      <span className="text-sm text-slate-400 block mb-5">Resumen de tu equipo</span>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          title="Promotores Activos"
          value={data.promotoresActivos}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Oportunidades Totales"
          value={data.totalGeneral}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Tabla promotores x etapas */}
      <div className="bg-surface rounded-xl border border-slate-800/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 sticky left-0 bg-slate-800/40 z-10">
                  Promotor
                </th>
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
    </div>
  );
}
