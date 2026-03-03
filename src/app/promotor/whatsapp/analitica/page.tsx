"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Send, CheckCheck, Megaphone, AlertCircle,
  Filter, Search, ChevronLeft, ChevronRight, BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import StatCard from "@/components/ui/StatCard";

interface PromotorStats {
  mensajes: { hoy: number; semana: number; mes: number };
  porEstado: { estado: string; count: number }[];
  campanasActivas: number;
  campanas: {
    id: number; nombre: string; estado: string; total_mensajes: number;
    enviados: number; entregados: number; leidos: number; fallidos: number;
    created_at: string;
  }[];
}

interface MensajePromotor {
  id: number;
  nombre_cliente: string | null;
  numero_destino: string;
  estado: string;
  error_detalle: string | null;
  enviado_at: string | null;
  entregado_at: string | null;
  leido_at: string | null;
  created_at: string;
  campana_id: number;
  campana_nombre: string;
}

interface MensajesData {
  mensajes: MensajePromotor[];
  total: number;
  page: number;
  limit: number;
}

type BadgeColor = "amber" | "green" | "red" | "blue" | "purple" | "teal" | "orange" | "slate";

const ESTADO_BADGE: Record<string, BadgeColor> = {
  PENDIENTE: "slate",
  ENVIANDO: "orange",
  ENVIADO: "blue",
  ENTREGADO: "green",
  LEIDO: "teal",
  FALLIDO: "red",
};

const ESTADO_CAMPANA_BADGE: Record<string, BadgeColor> = {
  CREADA: "slate",
  EN_COLA: "orange",
  ENVIANDO: "blue",
  PAUSADA: "amber",
  COMPLETADA: "green",
  CANCELADA: "red",
};

const ESTADOS = ["PENDIENTE", "ENVIANDO", "ENVIADO", "ENTREGADO", "LEIDO", "FALLIDO"];

function fmtDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

export default function AnaliticaWhatsAppPage() {
  // --- Stats ---
  const [stats, setStats] = useState<PromotorStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/promotor/whatsapp/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // --- Mensajes detalle ---
  const [mensajesData, setMensajesData] = useState<MensajesData | null>(null);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCampana, setFiltroCampana] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const fetchMensajes = useCallback(async (p = 1) => {
    setLoadingMensajes(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroCampana) params.set("campana_id", filtroCampana);
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);
      const res = await fetch(`/api/promotor/whatsapp/mensajes?${params}`);
      if (res.ok) setMensajesData(await res.json());
    } catch { /* ignore */ }
    setLoadingMensajes(false);
  }, [filtroEstado, filtroCampana, filtroDesde, filtroHasta]);

  useEffect(() => {
    fetchMensajes(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuscar = () => {
    setPage(1);
    fetchMensajes(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchMensajes(newPage);
  };

  const totalPages = mensajesData ? Math.ceil(mensajesData.total / LIMIT) : 0;

  const statCards: { label: string; value: number; icon: React.ReactNode; color: "blue" | "green" | "orange" | "purple" }[] = stats ? [
    { label: "Enviados Hoy", value: stats.mensajes.hoy, icon: <Send className="w-5 h-5" />, color: "blue" },
    { label: "Enviados Semana", value: stats.mensajes.semana, icon: <CheckCheck className="w-5 h-5" />, color: "green" },
    { label: "Enviados Mes", value: stats.mensajes.mes, icon: <Megaphone className="w-5 h-5" />, color: "orange" },
    { label: "Campanas Activas", value: stats.campanasActivas, icon: <Megaphone className="w-5 h-5" />, color: "purple" },
  ] : [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-5 h-5 text-slate-400" />
        <h1 className="text-xl font-semibold text-slate-100">Analitica de Envios</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Estadisticas y detalle de tus envios de WhatsApp
      </p>

      {loadingStats ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : !stats ? (
        <div className="text-center py-10">
          <span className="text-sm text-slate-400">Error al cargar estadisticas</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {statCards.map((card) => (
              <StatCard
                key={card.label}
                title={card.label}
                value={card.value}
                icon={card.icon}
                color={card.color}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-5">
            {/* Por Estado */}
            <div className="md:col-span-4 bg-surface rounded-xl border border-slate-800/60 p-5">
              <h2 className="text-sm font-semibold text-slate-100 mb-4">
                Mensajes por Estado (Mes)
              </h2>
              {stats.porEstado.length === 0 ? (
                <span className="text-sm text-slate-400">Sin datos</span>
              ) : (
                <div className="space-y-2">
                  {stats.porEstado.map((e) => (
                    <div key={e.estado} className="flex justify-between items-center">
                      <Badge color={ESTADO_BADGE[e.estado] || "slate"}>
                        {e.estado}
                      </Badge>
                      <span className="text-sm font-bold text-slate-200">{e.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historial de Campanas */}
            <div className="md:col-span-8 bg-surface rounded-xl border border-slate-800/60 p-5">
              <h2 className="text-sm font-semibold text-slate-100 mb-4">Historial de Campanas</h2>
              <div className="overflow-x-auto rounded-lg border border-slate-800/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/40">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Nombre</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-400">Estado</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-400">Progreso</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-400">
                        <span className="inline-flex items-center gap-1"><CheckCheck className="w-3 h-3" />Entreg.</span>
                      </th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-400">
                        <span className="inline-flex items-center gap-1"><Send className="w-3 h-3" />Leidos</span>
                      </th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-400">
                        <span className="inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" />Fallidos</span>
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {stats.campanas.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4">
                          <span className="text-sm text-slate-400">Sin campanas</span>
                        </td>
                      </tr>
                    ) : (
                      stats.campanas.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-3 py-2 max-w-[160px]">
                            <Tooltip content={c.nombre}>
                              <span className="text-sm text-slate-300 truncate block">{c.nombre}</span>
                            </Tooltip>
                          </td>
                          <td className="text-center px-3 py-2">
                            <Badge color={ESTADO_CAMPANA_BADGE[c.estado] || "slate"}>
                              {c.estado}
                            </Badge>
                          </td>
                          <td className="text-center px-3 py-2 text-xs text-slate-300">
                            {c.enviados}/{c.total_mensajes}
                          </td>
                          <td className="text-center px-3 py-2 font-semibold text-green-400">{c.entregados}</td>
                          <td className="text-center px-3 py-2 font-semibold text-teal-400">{c.leidos}</td>
                          <td className="text-center px-3 py-2 font-semibold text-red-400">{c.fallidos}</td>
                          <td className="text-right px-3 py-2 text-xs text-slate-500">{fmtDate(c.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* --- Detalle de Mensajes --- */}
          <div className="bg-surface rounded-xl border border-slate-800/60 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-100">Detalle de Mensajes</h2>
              {mensajesData && (
                <span className="text-xs text-slate-500 ml-auto">
                  {mensajesData.total} resultado{mensajesData.total !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Filtros */}
            <div className="flex gap-3 flex-wrap mb-4">
              <div className="min-w-[130px]">
                <Select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  options={ESTADOS.map((s) => ({ value: s, label: s }))}
                  placeholder="Todos"
                  label="Estado"
                  fullWidth={false}
                />
              </div>

              <div className="min-w-[160px]">
                <Select
                  value={filtroCampana}
                  onChange={(e) => setFiltroCampana(e.target.value)}
                  options={(stats.campanas || []).map((c) => ({ value: String(c.id), label: c.nombre }))}
                  placeholder="Todas"
                  label="Campana"
                  fullWidth={false}
                />
              </div>

              <div className="w-[160px]">
                <Input
                  label="Desde"
                  type="date"
                  value={filtroDesde}
                  onChange={(e) => setFiltroDesde(e.target.value)}
                  fullWidth={false}
                />
              </div>
              <div className="w-[160px]">
                <Input
                  label="Hasta"
                  type="date"
                  value={filtroHasta}
                  onChange={(e) => setFiltroHasta(e.target.value)}
                  fullWidth={false}
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Search className="w-4 h-4" />}
                  loading={loadingMensajes}
                  onClick={handleBuscar}
                >
                  Buscar
                </Button>
              </div>
            </div>

            <div className="h-px bg-slate-800/60 mb-4" />

            {/* Tabla */}
            {loadingMensajes ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <>
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-lg border border-slate-800/60">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-800/60">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Cliente</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Telefono</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Campana</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Estado</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Enviado</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Entregado</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Leido</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {!mensajesData || mensajesData.mensajes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8">
                            <span className="text-sm text-slate-400">Sin mensajes</span>
                          </td>
                        </tr>
                      ) : (
                        mensajesData.mensajes.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-2 max-w-[160px]">
                              <span className="text-sm font-medium text-slate-300 truncate block">
                                {m.nombre_cliente || "\u2014"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-300">{m.numero_destino}</td>
                            <td className="px-3 py-2 max-w-[140px]">
                              <Tooltip content={m.campana_nombre}>
                                <span className="text-xs text-slate-300 truncate block">
                                  {m.campana_nombre}
                                </span>
                              </Tooltip>
                            </td>
                            <td className="px-3 py-2">
                              <Badge color={ESTADO_BADGE[m.estado] || "slate"}>
                                {m.estado}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(m.enviado_at)}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(m.entregado_at)}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(m.leido_at)}</td>
                            <td className="px-3 py-2 max-w-[140px]">
                              {m.error_detalle ? (
                                <Tooltip content={m.error_detalle}>
                                  <span className="text-xs text-red-400 truncate block">
                                    {m.error_detalle}
                                  </span>
                                </Tooltip>
                              ) : "\u2014"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-4">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (page <= 4) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`
                            w-8 h-8 rounded-lg text-xs font-medium transition-colors
                            ${page === pageNum
                              ? "bg-amber-500 text-slate-950"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                            }
                          `.trim()}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
