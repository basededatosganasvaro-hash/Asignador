"use client";
import { useEffect, useState } from "react";
import { MessageCircle, CheckCheck, Eye, XCircle } from "lucide-react";

interface WAKpis {
  enviados: number;
  entregados: number;
  leidos: number;
  fallidos: number;
  tasaEntrega: number;
  tasaLectura: number;
}

interface PromotorWA {
  id: number;
  nombre: string;
  campanas: number;
  enviados: number;
  entregados: number;
  leidos: number;
  fallidos: number;
  tasaLectura: number;
}

interface TendenciaWA {
  semana: string;
  enviados: number;
  entregados: number;
  leidos: number;
}

export default function WhatsAppPage() {
  const [kpis, setKpis] = useState<WAKpis | null>(null);
  const [porPromotor, setPorPromotor] = useState<PromotorWA[]>([]);
  const [tendencia, setTendencia] = useState<TendenciaWA[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gerente/whatsapp")
      .then((r) => r.json())
      .then((data) => {
        setKpis(data.kpis);
        setPorPromotor(data.porPromotor ?? []);
        setTendencia(data.tendencia ?? []);
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

  if (!kpis) return <p className="text-slate-400">Error al cargar datos</p>;

  const maxEnviados = Math.max(...tendencia.map((t) => t.enviados), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Rendimiento WhatsApp</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase">Enviados (mes)</span>
            <MessageCircle className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{kpis.enviados.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase">Entregados</span>
            <CheckCheck className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">{kpis.entregados.toLocaleString()}</p>
          <p className="text-sm text-green-400 mt-0.5">{kpis.tasaEntrega}% tasa entrega</p>
        </div>
        <div className="bg-card border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase">Leídos</span>
            <Eye className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white">{kpis.leidos.toLocaleString()}</p>
          <p className="text-sm text-cyan-400 mt-0.5">{kpis.tasaLectura}% tasa lectura</p>
        </div>
      </div>

      {kpis.fallidos > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-300 text-sm">{kpis.fallidos} mensajes fallidos este mes</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencia semanal */}
        <div className="bg-card border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Tendencia Semanal</h2>
          {tendencia.length === 0 ? (
            <p className="text-slate-500 text-sm">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {tendencia.map((t, i) => {
                const fecha = new Date(t.semana);
                const label = `${fecha.getDate()}/${fecha.getMonth() + 1}`;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Semana del {label}</span>
                      <span>{t.enviados} enviados</span>
                    </div>
                    <div className="h-6 bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-blue-500/60"
                        style={{ width: `${(t.enviados / maxEnviados) * 100}%` }}
                        title={`${t.enviados} enviados`}
                      />
                      <div
                        className="h-full bg-green-500/60 -ml-px"
                        style={{ width: `${((t.entregados - t.leidos) / maxEnviados) * 100}%` }}
                        title={`${t.entregados} entregados`}
                      />
                      <div
                        className="h-full bg-cyan-500/60 -ml-px"
                        style={{ width: `${(t.leidos / maxEnviados) * 100}%` }}
                        title={`${t.leidos} leídos`}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500/60 rounded" /> Enviados</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500/60 rounded" /> Entregados</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-cyan-500/60 rounded" /> Leídos</span>
              </div>
            </div>
          )}
        </div>

        {/* Por promotor */}
        <div className="bg-card border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Por Promotor</h2>
          {porPromotor.length === 0 ? (
            <p className="text-slate-500 text-sm">Sin campañas este mes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
                    <th className="text-left px-2 py-2">Promotor</th>
                    <th className="text-right px-2 py-2">Camp.</th>
                    <th className="text-right px-2 py-2">Env.</th>
                    <th className="text-right px-2 py-2">Ent.</th>
                    <th className="text-right px-2 py-2">Leídos</th>
                    <th className="text-right px-2 py-2">% Lect.</th>
                  </tr>
                </thead>
                <tbody>
                  {porPromotor.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/50">
                      <td className="px-2 py-2 text-white whitespace-nowrap">{p.nombre}</td>
                      <td className="px-2 py-2 text-right text-slate-400">{p.campanas}</td>
                      <td className="px-2 py-2 text-right text-slate-300">{p.enviados}</td>
                      <td className="px-2 py-2 text-right text-slate-300">{p.entregados}</td>
                      <td className="px-2 py-2 text-right text-slate-300">{p.leidos}</td>
                      <td className={`px-2 py-2 text-right font-semibold ${
                        p.tasaLectura >= 30 ? "text-green-400" : p.tasaLectura >= 15 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {p.tasaLectura}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
