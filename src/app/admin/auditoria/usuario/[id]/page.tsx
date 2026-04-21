"use client";
import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { User, ArrowLeft, Activity, TrendingUp } from "lucide-react";

interface UsuarioInfo {
  id: number;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
}

interface Evento {
  id: string | number;
  accion: string;
  recurso_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

interface Data {
  usuario: UsuarioInfo;
  dias: number;
  eventos: Evento[];
  porAccion: { accion: string; total: number }[];
  recursosUnicos: { recurso_id: string; accion: string; visitas: number; ultima: string }[];
  actividadPorHora: { hora: string; eventos: number }[];
}

export default function UsuarioAuditoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/auditoria/usuario/${id}?dias=${dias}`);
      if (res.ok) setData(await res.json());
      else toast("Error al cargar", "error");
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setLoading(false);
    }
  }, [id, dias, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const maxHora = Math.max(...data.actividadPorHora.map((h) => h.eventos), 1);
  const totalEventos = data.porAccion.reduce((s, a) => s + a.total, 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/auditoria" className="text-slate-400 hover:text-slate-200">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <User className="w-6 h-6 text-amber-400" />
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            {data.usuario.nombre}
          </h1>
          <p className="text-xs text-slate-500">
            @{data.usuario.username} · rol: {data.usuario.rol} · {data.usuario.activo ? "activo" : "inactivo"}
          </p>
        </div>
        <div className="ml-auto flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`px-3 py-1.5 text-xs rounded ${
                dias === d
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-slate-800/40 text-slate-400 border border-slate-700/40 hover:bg-slate-800/60"
              }`}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Eventos totales" value={totalEventos} />
        <KpiCard label="Recursos únicos" value={data.recursosUnicos.length} color="text-blue-400" />
        <KpiCard
          label="Acción más frecuente"
          value={data.porAccion[0]?.accion ?? "—"}
          sub={data.porAccion[0] ? `${data.porAccion[0].total}` : ""}
          color="text-emerald-400"
        />
        <KpiCard
          label="Pico hora"
          value={maxHora}
          sub="eventos en 1 hora"
          color={maxHora > 100 ? "text-red-400" : "text-slate-100"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Desglose por acción */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3 text-slate-300">
            <Activity className="w-4 h-4" /> <h3 className="font-semibold text-sm">Por acción</h3>
          </div>
          <ul className="space-y-2">
            {data.porAccion.map((a) => (
              <li key={a.accion} className="flex items-center justify-between text-sm">
                <Badge color="slate">{a.accion}</Badge>
                <span className="font-mono text-slate-300">{a.total.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Heatmap actividad por hora */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3 text-slate-300">
            <TrendingUp className="w-4 h-4" /> <h3 className="font-semibold text-sm">Actividad (eventos/hora)</h3>
          </div>
          <div className="flex items-end gap-0.5 h-32">
            {data.actividadPorHora.map((h) => {
              const pct = (h.eventos / maxHora) * 100;
              return (
                <div
                  key={h.hora}
                  className="flex-1 bg-amber-500/40 hover:bg-amber-400/60 rounded-t"
                  style={{ height: `${Math.max(pct, 2)}%` }}
                  title={`${h.hora} — ${h.eventos} eventos`}
                />
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2">Últimos {data.dias} días · {data.actividadPorHora.length} buckets horarios</p>
        </div>
      </div>

      {/* Recursos consultados */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3 mb-4">
        <h3 className="font-semibold text-sm text-slate-300 mb-3">Recursos más consultados</h3>
        {data.recursosUnicos.length === 0 ? (
          <p className="text-sm text-slate-500">Sin actividad.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase">
                <tr>
                  <th className="text-left py-1">Recurso</th>
                  <th className="text-left py-1">Acción</th>
                  <th className="text-right py-1">Visitas</th>
                  <th className="text-right py-1">Última</th>
                </tr>
              </thead>
              <tbody>
                {data.recursosUnicos.slice(0, 25).map((r, i) => (
                  <tr key={i} className="border-t border-slate-800/40">
                    <td className="py-1.5">
                      <Link href={`/admin/auditoria/cliente/${r.recurso_id}`} className="text-amber-400 hover:underline font-mono">
                        {r.recurso_id}
                      </Link>
                    </td>
                    <td className="py-1.5"><Badge color="slate">{r.accion}</Badge></td>
                    <td className="py-1.5 text-right font-mono text-slate-300">{r.visitas}</td>
                    <td className="py-1.5 text-right text-xs text-slate-500">{new Date(r.ultima).toLocaleString("es-MX")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Últimos eventos */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3">
        <h3 className="font-semibold text-sm text-slate-300 mb-3">Últimos eventos (500 máx.)</h3>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-xs uppercase sticky top-0 bg-slate-900">
              <tr>
                <th className="text-left py-1">Fecha</th>
                <th className="text-left py-1">Acción</th>
                <th className="text-left py-1">Recurso</th>
                <th className="text-left py-1">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.eventos.map((e) => (
                <tr key={String(e.id)} className="border-t border-slate-800/40">
                  <td className="py-1.5 font-mono text-xs text-slate-400">{new Date(e.created_at).toLocaleString("es-MX")}</td>
                  <td className="py-1.5"><Badge color="slate">{e.accion}</Badge></td>
                  <td className="py-1.5 font-mono text-xs">{e.recurso_id ?? "—"}</td>
                  <td className="py-1.5 font-mono text-xs text-slate-500">{e.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4">
        <Link href={`/admin/auditoria?usuario_id=${id}`}>
          <Button variant="ghost">Ver eventos completos con filtros</Button>
        </Link>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color = "text-slate-100" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
