"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { Download, RefreshCw, Users, ClipboardList, CheckCircle, Clock } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";

const FUENTES = ["IEPPO", "CDMX", "PENSIONADOS"] as const;
type Fuente = (typeof FUENTES)[number];
type Filtro = Fuente | "TODAS";

const FUENTE_COLOR: Record<Fuente, { bar: string; ring: string; text: string }> = {
  IEPPO: { bar: "bg-blue-500", ring: "ring-blue-500/30", text: "text-blue-400" },
  CDMX: { bar: "bg-purple-500", ring: "ring-purple-500/30", text: "text-purple-400" },
  PENSIONADOS: { bar: "bg-teal-500", ring: "ring-teal-500/30", text: "text-teal-400" },
};

interface ResumenFuente {
  fuente: Fuente;
  ronda_actual: number;
  universo: number;
  calificados_historico: number;
  pct_avance_total: number;
  asignados_rango: number;
  calificados_rango: number;
  pendientes_rango: number;
  pct_avance_rango: number;
  promotores_activos: number;
  lotes: { PENDIENTE: number; EN_PROCESO: number; DEVUELTO: number; total: number };
}

interface PromotorRow {
  id: number;
  nombre: string;
  username: string;
  sucursal: string;
  permisos: string[];
  activo: boolean;
  asignados: number;
  calificados: number;
  pendientes: number;
  pct_avance: number;
  por_tipo: Record<Fuente, { asignados: number; calificados: number }>;
  lotes: number;
  ultimo_lote: string | null;
}

interface RetroRow {
  id: number | null;
  nombre: string;
  total: number;
}

function defaultRango() {
  const hoy = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - 6);
  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hoy.toISOString().slice(0, 10),
  };
}

export default function AvanceClient() {
  const [rango, setRango] = useState(defaultRango());
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [q, setQ] = useState("");
  const [resumen, setResumen] = useState<ResumenFuente[]>([]);
  const [promotores, setPromotores] = useState<PromotorRow[]>([]);
  const [retro, setRetro] = useState<RetroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryBase = useMemo(() => {
    const p = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
    if (filtro !== "TODAS") p.set("tipo", filtro);
    return p.toString();
  }, [rango, filtro]);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
      const qsFiltrado = new URLSearchParams(qs);
      if (filtro !== "TODAS") qsFiltrado.set("tipo", filtro);
      if (q.trim()) qsFiltrado.set("q", q.trim());

      const [r1, r2, r3] = await Promise.all([
        fetch(`/api/admin/calificacion-avance/resumen?${qs.toString()}`),
        fetch(`/api/admin/calificacion-avance/promotores?${qsFiltrado.toString()}`),
        fetch(`/api/admin/calificacion-avance/retroalimentacion?${qsFiltrado.toString()}`),
      ]);
      if (!r1.ok || !r2.ok || !r3.ok) throw new Error("Error al cargar datos");
      const [j1, j2, j3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      setResumen(j1.data);
      setPromotores(j2.data);
      setRetro(j3.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango, filtro]);

  const columns = useMemo<ColumnDef<PromotorRow, unknown>[]>(() => {
    const cols: ColumnDef<PromotorRow, unknown>[] = [
      { accessorKey: "nombre", header: "Promotor" },
      { accessorKey: "sucursal", header: "Sucursal" },
      {
        id: "permisos",
        header: "Fuentes",
        cell: ({ row }) => (
          <div className="flex gap-1 flex-wrap">
            {row.original.permisos.map((p) => (
              <span key={p} className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300">
                {p}
              </span>
            ))}
          </div>
        ),
      },
      { accessorKey: "lotes", header: "Lotes", meta: { align: "center" } },
      { accessorKey: "asignados", header: "Asignados", meta: { align: "center" } },
      {
        accessorKey: "calificados",
        header: "Calificados",
        cell: ({ getValue }) => (
          <span className="text-green-400 font-medium">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "pendientes",
        header: "Pendientes",
        cell: ({ getValue }) => (
          <span className="text-amber-400">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "pct_avance",
        header: "% Avance",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full bg-green-500"
                style={{ width: `${row.original.pct_avance}%` }}
              />
            </div>
            <span className="text-xs text-slate-300 w-10 text-right">
              {row.original.pct_avance.toFixed(0)}%
            </span>
          </div>
        ),
      },
      { accessorKey: "ultimo_lote", header: "Último lote", meta: { align: "center" } },
    ];
    return cols;
  }, []);

  const retroChartData = retro.map((r) => ({ name: r.nombre, total: r.total }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-xl font-bold text-slate-100">
          Avance de Calificación
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-sm">
            <input
              type="date"
              value={rango.desde}
              onChange={(e) => setRango({ ...rango, desde: e.target.value })}
              className="bg-surface border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs"
            />
            <span className="text-slate-500">→</span>
            <input
              type="date"
              value={rango.hasta}
              onChange={(e) => setRango({ ...rango, hasta: e.target.value })}
              className="bg-surface border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs"
            />
          </div>
          <button
            onClick={cargar}
            className="p-2 rounded hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
            title="Refrescar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <a
            href={`/api/admin/calificacion-avance/export?${queryBase}`}
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium px-3 py-2 rounded"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className="grid gap-3 mb-5 md:grid-cols-2 xl:grid-cols-3">
        {resumen.map((r) => (
          <TarjetaFuente key={r.fuente} r={r} />
        ))}
        {loading && resumen.length === 0 && (
          <div className="col-span-full flex justify-center py-10">
            <Spinner />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex rounded-lg bg-surface border border-slate-800 p-0.5">
          {(["TODAS", ...FUENTES] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                filtro === f
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar promotor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && cargar()}
          className="bg-surface border border-slate-700 rounded px-3 py-1.5 text-slate-200 text-xs flex-1 max-w-sm"
        />
        <button
          onClick={cargar}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded"
        >
          Buscar
        </button>
      </div>

      <h2 className="text-sm font-semibold text-slate-200 mb-2">
        Desglose por promotor
      </h2>
      <DataTable
        data={promotores}
        columns={columns}
        loading={loading}
        pageSize={25}
        emptyMessage="Sin actividad en el rango"
        getRowId={(row) => String(row.id)}
      />

      <h2 className="text-sm font-semibold text-slate-200 mt-6 mb-2">
        Distribución de retroalimentación{" "}
        {filtro !== "TODAS" && <span className="text-slate-500">· {filtro}</span>}
      </h2>
      <div className="bg-surface rounded-xl border border-slate-800/60 p-4">
        {retroChartData.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Sin calificaciones en el rango.
          </p>
        ) : (
          <div className="w-full h-[320px]">
            <ResponsiveContainer>
              <BarChart data={retroChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <RTooltip
                  contentStyle={{
                    backgroundColor: "#1E2538",
                    border: "1px solid rgba(51,65,85,0.6)",
                    borderRadius: "0.5rem",
                    color: "#e2e8f0",
                    fontSize: "0.75rem",
                  }}
                />
                <Bar dataKey="total" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function TarjetaFuente({ r }: { r: ResumenFuente }) {
  const c = FUENTE_COLOR[r.fuente];
  return (
    <div className={`bg-surface rounded-xl border border-slate-800/60 p-4 ring-1 ${c.ring}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>
            {r.fuente}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Ronda actual: {r.ronda_actual}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500">Avance total</p>
          <p className="font-display text-lg font-bold text-slate-100">
            {r.pct_avance_total.toFixed(1)}%
          </p>
        </div>
      </div>
      <div className="h-2 bg-slate-800 rounded overflow-hidden mb-3">
        <div
          className={`h-full ${c.bar}`}
          style={{ width: `${Math.min(100, r.pct_avance_total)}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mb-3">
        <span className="font-medium text-slate-200">
          {r.calificados_historico.toLocaleString()}
        </span>{" "}
        de{" "}
        <span className="font-medium text-slate-200">
          {r.universo.toLocaleString()}
        </span>{" "}
        calificados
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Mini icon={<ClipboardList className="w-3.5 h-3.5" />} label="Asignados" value={r.asignados_rango} />
        <Mini icon={<CheckCircle className="w-3.5 h-3.5 text-green-400" />} label="Calificados" value={r.calificados_rango} />
        <Mini icon={<Clock className="w-3.5 h-3.5 text-amber-400" />} label="Pendientes" value={r.pendientes_rango} />
        <Mini icon={<Users className="w-3.5 h-3.5 text-purple-400" />} label="Promotores" value={r.promotores_activos} />
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-[10px] text-slate-500">
        <span>Lotes: <b className="text-slate-300">{r.lotes.total}</b></span>
        <span>Pend: <b className="text-slate-300">{r.lotes.PENDIENTE}</b></span>
        <span>En proc: <b className="text-slate-300">{r.lotes.EN_PROCESO}</b></span>
        <span>Dev: <b className="text-slate-300">{r.lotes.DEVUELTO}</b></span>
      </div>
    </div>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <div>
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className="font-semibold text-slate-200">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
