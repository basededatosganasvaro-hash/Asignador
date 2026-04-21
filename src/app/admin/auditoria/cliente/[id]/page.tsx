"use client";
import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { FileSearch, ArrowLeft } from "lucide-react";

interface Evento {
  id: string | number;
  accion: string;
  usuario_id: number | null;
  username: string | null;
  rol: string | null;
  recurso_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

interface Data {
  cliente_id: string;
  total_eventos: number;
  usuarios_unicos: number;
  eventos_directos: Evento[];
  eventos_metadata: Evento[];
}

export default function ClienteAuditoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/auditoria/cliente/${id}`);
      if (res.ok) setData(await res.json());
      else toast("Error al cargar", "error");
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const todos = [...data.eventos_directos, ...data.eventos_metadata].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/auditoria" className="text-slate-400 hover:text-slate-200">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <FileSearch className="w-6 h-6 text-amber-400" />
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">Recurso #{id}</h1>
          <p className="text-xs text-slate-500">Historial de consultas y acciones</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <KpiCard label="Total eventos" value={data.total_eventos} />
        <KpiCard label="Usuarios únicos" value={data.usuarios_unicos} color="text-blue-400" />
      </div>

      <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3">
        <h3 className="font-semibold text-sm text-slate-300 mb-3">Timeline</h3>
        {todos.length === 0 ? (
          <p className="text-sm text-slate-500">Sin eventos registrados para este recurso.</p>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase sticky top-0 bg-slate-900">
                <tr>
                  <th className="text-left py-1">Fecha</th>
                  <th className="text-left py-1">Usuario</th>
                  <th className="text-left py-1">Rol</th>
                  <th className="text-left py-1">Acción</th>
                  <th className="text-left py-1">IP</th>
                </tr>
              </thead>
              <tbody>
                {todos.map((e) => (
                  <tr key={String(e.id)} className="border-t border-slate-800/40">
                    <td className="py-1.5 font-mono text-xs text-slate-400">{new Date(e.created_at).toLocaleString("es-MX")}</td>
                    <td className="py-1.5">
                      {e.usuario_id ? (
                        <Link href={`/admin/auditoria/usuario/${e.usuario_id}`} className="text-amber-400 hover:underline">
                          {e.username ?? `#${e.usuario_id}`}
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-1.5 text-xs text-slate-400">{e.rol ?? "—"}</td>
                    <td className="py-1.5"><Badge color="slate">{e.accion}</Badge></td>
                    <td className="py-1.5 font-mono text-xs text-slate-500">{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color = "text-slate-100" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}
