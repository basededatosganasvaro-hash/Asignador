"use client";
import { useEffect, useState } from "react";
import { ArrowUpDown } from "lucide-react";

interface Promotor {
  id: number;
  nombre: string;
  equipo: string | null;
  sucursal: string | null;
  oppActivas: number;
  asignadas: number;
  ventas: number;
  monto: number;
  conversion: number;
  interacciones: number;
  diasPromedio: number | null;
  timersVencidos: number;
  cupoHoy: number;
}

type SortKey = keyof Promotor;

export default function PromotoresPage() {
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes");
  const [sortKey, setSortKey] = useState<SortKey>("ventas");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/gerente/promotores?periodo=${periodo}`)
      .then((r) => r.json())
      .then((data) => setPromotores(data.promotores ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [periodo]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...promotores].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    if (typeof va === "string" && typeof vb === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const conversionColor = (c: number) => {
    if (c >= 20) return "text-green-400";
    if (c >= 10) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Ranking de Promotores</h1>
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

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      ) : promotores.length === 0 ? (
        <p className="text-slate-500">No hay promotores en tu alcance</p>
      ) : (
        <div className="bg-card border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
                  <Th label="Promotor" sortKey="nombre" currentSort={sortKey} asc={sortAsc} onClick={handleSort} />
                  <Th label="Equipo" sortKey="equipo" currentSort={sortKey} asc={sortAsc} onClick={handleSort} />
                  <Th label="Activas" sortKey="oppActivas" currentSort={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                  <Th label="Asignadas" sortKey="asignadas" currentSort={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                  <Th label="Ventas" sortKey="ventas" currentSort={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                  <Th label="Monto" sortKey="monto" currentSort={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                  <Th label="Conversión" sortKey="conversion" currentSort={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                  <Th label="Interacciones" sortKey="interacciones" currentSort={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                  <Th label="Días Prom." sortKey="diasPromedio" currentSort={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                  <Th label="Timers" sortKey="timersVencidos" currentSort={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                  <Th label="Cupo Hoy" sortKey="cupoHoy" currentSort={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.id} className={`border-b border-slate-800/50 ${i % 2 === 0 ? "bg-slate-900/30" : ""}`}>
                    <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{p.nombre}</td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{p.equipo ?? p.sucursal ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{p.oppActivas}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{p.asignadas}</td>
                    <td className="px-3 py-2.5 text-right text-white font-semibold">{p.ventas}</td>
                    <td className="px-3 py-2.5 text-right text-green-400">${p.monto.toLocaleString()}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${conversionColor(p.conversion)}`}>
                      {p.conversion}%
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{p.interacciones}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{p.diasPromedio ?? "—"}</td>
                    <td className={`px-3 py-2.5 text-right ${p.timersVencidos > 3 ? "text-red-400 font-semibold" : "text-slate-400"}`}>
                      {p.timersVencidos}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{p.cupoHoy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alertas */}
      {!loading && promotores.filter((p) => p.interacciones === 0).length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 font-semibold text-sm mb-1">Promotores sin actividad en el periodo</p>
          <p className="text-red-300 text-sm">
            {promotores.filter((p) => p.interacciones === 0).map((p) => p.nombre).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

function Th({ label, sortKey, currentSort, asc, onClick, align = "left" }: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className={`px-3 py-3 cursor-pointer hover:text-slate-300 transition-colors select-none ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? "text-amber-400" : "text-slate-700"}`} />
        {active && <span className="text-amber-400 text-[10px]">{asc ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}
