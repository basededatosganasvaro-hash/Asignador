"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Smartphone, HelpCircle, Unplug,
  Send, CheckCheck, Megaphone, AlertCircle,
  Filter, Search, ChevronLeft, ChevronRight, BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import StatCard from "@/components/ui/StatCard";
import WhatsAppQRDialog from "@/components/WhatsAppQRDialog";
import WhatsAppGuiaModal from "@/components/WhatsAppGuiaModal";
import CampanaProgreso from "@/components/CampanaProgreso";

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface WaStatus {
  estado: string;
  numero_wa: string | null;
  ultimo_uso: string | null;
  activo_en_memoria: boolean;
}

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

export default function WhatsAppPage() {
  // --- Conexion ---
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [guiaOpen, setGuiaOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("wa_guia_vista")) setGuiaOpen(true);
  }, []);

  const handleGuiaClose = () => {
    localStorage.setItem("wa_guia_vista", "1");
    setGuiaOpen(false);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/sesion/estado");
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/whatsapp/sesion/disconnect", { method: "POST" });
      await fetchStatus();
    } catch { /* ignore */ }
    setDisconnecting(false);
  };

  const isConnected = status?.estado === "CONECTADO";

  // --- Analitica ---
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
      {/* ===== SECCION EXISTENTE: Conexion + Campanas ===== */}
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-semibold text-slate-100">WhatsApp Masivo</h1>
        <Tooltip content="Estrategias anti-bloqueo">
          <button
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800/50"
            onClick={() => setGuiaOpen(true)}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Envia mensajes masivos a tus clientes desde tu WhatsApp
      </p>

      {/* Estado de conexion */}
      <Card className="mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Smartphone className={`w-10 h-10 ${isConnected ? "text-[#25D366]" : "text-slate-600"}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">WhatsApp</span>
              {isConnected ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#25D366] text-white">
                  Conectado
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300">
                  {status?.estado || "Desconectado"}
                </span>
              )}
            </div>
            {isConnected && status?.numero_wa && (
              <p className="text-sm text-slate-500">
                Numero: +{status.numero_wa}
              </p>
            )}
            {status?.ultimo_uso && (
              <p className="text-xs text-slate-500">
                Ultimo uso: {new Date(status.ultimo_uso).toLocaleString("es-MX")}
              </p>
            )}
          </div>

          {isConnected ? (
            <Button
              variant="danger"
              size="sm"
              icon={<Unplug className="w-4 h-4" />}
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              Desconectar
            </Button>
          ) : (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors bg-[#25D366] hover:bg-[#1da851]"
              onClick={() => setQrOpen(true)}
            >
              <WhatsAppIcon className="w-4 h-4" />
              Conectar WhatsApp
            </button>
          )}
        </div>
      </Card>

      {!isConnected && (
        <Alert variant="info" className="mb-6">
          Conecta tu WhatsApp para poder enviar mensajes masivos. Ve a &quot;Mi Asignacion&quot;,
          selecciona clientes y usa el boton &quot;Enviar WhatsApp Masivo&quot;.
        </Alert>
      )}

      {/* Campanas activas */}
      <CampanaProgreso />

      {/* Guia anti-bloqueo */}
      <WhatsAppGuiaModal open={guiaOpen} onClose={handleGuiaClose} />

      {/* QR Dialog */}
      <WhatsAppQRDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onConnected={() => { setQrOpen(false); fetchStatus(); }}
      />

      {/* ===== SEPARADOR ===== */}
      <div className="h-px bg-slate-800/60 my-6" />

      {/* ===== SECCION ANALITICA ===== */}
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-100">Analitica de Envios</h2>
      </div>

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
