"use client";
import { Fragment, useEffect, useState } from "react";
import { Database, ClipboardList, CheckCircle, Users, ChevronRight, ChevronDown } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";

interface Etapa {
  id: number;
  nombre: string;
  orden: number;
  color: string;
}

interface Integrante {
  id: number;
  nombre: string;
  total: number;
  etapas: Record<number, number>;
}

interface EquipoRow {
  id: number;
  nombre: string;
  total: number;
  etapas: Record<number, number>;
  integrantes: Integrante[];
}

interface DashboardData {
  totalClientes: number;
  clientesAsignados: number;
  clientesDisponibles: number;
  totalPromotores: number;
  lotesHoy: number;
  etapas: Etapa[];
  porEquipo: EquipoRow[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar datos");
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Error de conexión");
        setLoading(false);
      });
  }, []);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center mt-20">
        <Alert variant="error" className="max-w-md">{error}</Alert>
      </div>
    );
  }

  const etapas = data?.etapas ?? [];
  const equipos = data?.porEquipo ?? [];

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-slate-100 mb-6">
        Dashboard
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <StatCard title="Total Clientes" value={data?.totalClientes.toLocaleString() ?? 0} icon={<Database className="w-5 h-5" />} color="blue" />
        <StatCard title="Asignados" value={data?.clientesAsignados.toLocaleString() ?? 0} icon={<ClipboardList className="w-5 h-5" />} color="green" />
        <StatCard title="Disponibles" value={data?.clientesDisponibles.toLocaleString() ?? 0} icon={<CheckCircle className="w-5 h-5" />} color="orange" />
        <StatCard title="Promotores Activos" value={data?.totalPromotores ?? 0} icon={<Users className="w-5 h-5" />} color="purple" />
        <StatCard title="Lotes Hoy" value={data?.lotesHoy ?? 0} icon={<ClipboardList className="w-5 h-5" />} color="blue" />
      </div>

      <h2 className="text-lg font-semibold text-slate-100 mb-3">
        Datos trabajados hoy por equipo
      </h2>

      <div className="bg-surface rounded-xl border border-slate-800/60 overflow-hidden">
        <div className="overflow-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/40 border-b border-slate-800/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Equipo</th>
                {etapas.map((e) => (
                  <th key={e.id} className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {e.nombre}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {equipos.length === 0 ? (
                <tr>
                  <td colSpan={etapas.length + 3} className="py-16 text-center text-slate-500">
                    Sin movimiento hoy
                  </td>
                </tr>
              ) : (
                equipos.map((eq) => {
                  const isOpen = expanded.has(eq.id);
                  return (
                    <Fragment key={`eq-${eq.id}`}>
                      <tr
                        className="hover:bg-surface-hover transition-colors cursor-pointer"
                        onClick={() => toggle(eq.id)}
                      >
                        <td className="px-4 py-3 text-slate-400">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 text-slate-100 font-medium">{eq.nombre}</td>
                        {etapas.map((e) => (
                          <td key={e.id} className="px-4 py-3 text-center" style={{ color: e.color }}>
                            {eq.etapas[e.id] ?? 0}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center font-semibold text-slate-100">{eq.total}</td>
                      </tr>
                      {isOpen &&
                        (eq.integrantes.length === 0 ? (
                          <tr className="bg-slate-900/30">
                            <td colSpan={etapas.length + 3} className="px-4 py-3 text-center text-xs text-slate-500">
                              Sin integrantes con movimiento
                            </td>
                          </tr>
                        ) : (
                          eq.integrantes.map((it) => (
                            <tr key={`u-${it.id}`} className="bg-slate-900/30">
                              <td></td>
                              <td className="px-4 py-2 pl-10 text-slate-300 text-xs">{it.nombre}</td>
                              {etapas.map((e) => (
                                <td key={e.id} className="px-4 py-2 text-center text-xs" style={{ color: e.color }}>
                                  {it.etapas[e.id] ?? 0}
                                </td>
                              ))}
                              <td className="px-4 py-2 text-center text-xs font-medium text-slate-200">{it.total}</td>
                            </tr>
                          ))
                        ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
