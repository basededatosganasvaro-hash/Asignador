"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  History, ChevronLeft, ChevronRight, Copy, Search,
} from "lucide-react";

interface BusquedaLog {
  id: number;
  cliente_id: number;
  campo: string;
  created_at: string;
}

interface Busqueda {
  id: number;
  tipo: string;
  valor: string;
  motivo: string;
  resultados: number;
  created_at: string;
  usuario: {
    id: number;
    nombre: string;
    username: string;
    rol: string;
  };
  logs: BusquedaLog[];
}

interface ApiResponse {
  busquedas: Busqueda[];
  total: number;
  page: number;
  totalPages: number;
}

const MOTIVO_LABELS: Record<string, string> = {
  calificacion: "Calificacion",
  tramite: "Tramite",
  prospeccion: "Prospeccion",
  validacion_datos: "Validacion de datos",
  solicitud_pantalla: "Solicitud de pantalla",
  solicitud_capacidad: "Solicitud de capacidad",
};

export default function HistorialBusquedasPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (fechaDesde) params.set("fecha_desde", fechaDesde);
    if (fechaHasta) params.set("fecha_hasta", fechaHasta);

    try {
      const res = await fetch(`/api/admin/busquedas-clientes?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      toast("Error al cargar historial", "error");
    }
    setLoading(false);
  }, [fechaDesde, fechaHasta, toast]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleFilter = () => {
    setPage(1);
    fetchData(1);
  };

  const goPage = (p: number) => {
    setPage(p);
    fetchData(p);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-violet-500 flex items-center justify-center">
          <History className="w-7 h-7 text-slate-950" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            Historial de Busquedas
          </h1>
          <span className="text-sm text-slate-400">
            Registro de todas las busquedas de clientes realizadas por promotores y supervisores
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-surface rounded-xl border border-slate-800/60 p-5 mb-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-violet-600" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Input
            label="Desde"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
          <Input
            label="Hasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
          <Button
            variant="primary"
            icon={<Search className="w-4 h-4" />}
            onClick={handleFilter}
            className="!bg-violet-600 hover:!bg-violet-500"
          >
            Filtrar
          </Button>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : !data || data.busquedas.length === 0 ? (
        <div className="bg-surface rounded-xl border border-slate-800/60 p-8 text-center">
          <p className="text-slate-400">No hay busquedas registradas</p>
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-xl border border-slate-800/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800/60">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Usuario</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Rol</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Tipo</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Valor</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Motivo</th>
                    <th className="text-center px-4 py-3 text-slate-400 font-medium">Resultados</th>
                    <th className="text-center px-4 py-3 text-slate-400 font-medium">Copias</th>
                  </tr>
                </thead>
                <tbody>
                  {data.busquedas.map((b) => (
                    <>
                      <tr
                        key={b.id}
                        className="border-b border-slate-800/30 hover:bg-slate-800/20 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                      >
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                          {new Date(b.created_at).toLocaleString("es-MX", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          {b.usuario.nombre}
                          <span className="text-slate-500 ml-1">@{b.usuario.username}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            b.usuario.rol === "supervisor"
                              ? "bg-blue-500/15 text-blue-400"
                              : "bg-green-500/15 text-green-400"
                          }`}>
                            {b.usuario.rol}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{b.tipo}</td>
                        <td className="px-4 py-3 text-slate-200 font-mono text-xs">{b.valor}</td>
                        <td className="px-4 py-3 text-slate-300">{MOTIVO_LABELS[b.motivo] || b.motivo}</td>
                        <td className="px-4 py-3 text-center text-slate-300">{b.resultados}</td>
                        <td className="px-4 py-3 text-center">
                          {b.logs.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-400">
                              <Copy className="w-3.5 h-3.5" />
                              {b.logs.length}
                            </span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                      </tr>
                      {expandedId === b.id && b.logs.length > 0 && (
                        <tr key={`${b.id}-logs`}>
                          <td colSpan={8} className="px-8 py-3 bg-slate-800/30">
                            <p className="text-xs font-medium text-slate-400 mb-2">Detalle de copiado:</p>
                            <div className="flex flex-wrap gap-2">
                              {b.logs.map((log) => (
                                <span
                                  key={log.id}
                                  className="text-xs bg-slate-700/50 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/40"
                                >
                                  Cliente #{log.cliente_id} — <span className="text-amber-400">{log.campo}</span>
                                  <span className="text-slate-500 ml-1.5">
                                    {new Date(log.created_at).toLocaleTimeString("es-MX", {
                                      hour: "2-digit", minute: "2-digit",
                                    })}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginacion */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-slate-400">
                Pagina {data.page} de {data.totalPages} ({data.total} registros)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ChevronLeft className="w-4 h-4" />}
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ChevronRight className="w-4 h-4" />}
                  disabled={page >= data.totalPages}
                  onClick={() => goPage(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
