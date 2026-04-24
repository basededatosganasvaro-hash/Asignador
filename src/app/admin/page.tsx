"use client";
import { useEffect, useMemo, useState } from "react";
import { Database, ClipboardList, CheckCircle, Users } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import StatCard from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";

interface Etapa {
  id: number;
  nombre: string;
  orden: number;
  color: string;
}

interface EquipoRow {
  id: number;
  nombre: string;
  total: number;
  etapas: Record<number, number>;
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

  const columns = useMemo<ColumnDef<EquipoRow, unknown>[]>(() => {
    if (!data) return [];
    const etapaCols: ColumnDef<EquipoRow, unknown>[] = data.etapas.map((e) => ({
      id: `etapa_${e.id}`,
      header: e.nombre,
      accessorFn: (row) => row.etapas[e.id] ?? 0,
      cell: ({ getValue }) => (
        <span className="text-center block" style={{ color: e.color }}>
          {getValue() as number}
        </span>
      ),
      meta: { align: "center" },
    }));
    return [
      { accessorKey: "nombre", header: "Equipo" },
      ...etapaCols,
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ getValue }) => (
          <span className="text-center block font-semibold text-slate-100">
            {getValue() as number}
          </span>
        ),
        meta: { align: "center" },
      },
    ];
  }, [data]);

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

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-slate-100 mb-6">
        Dashboard
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <StatCard
          title="Total Clientes"
          value={data?.totalClientes.toLocaleString() ?? 0}
          icon={<Database className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Asignados"
          value={data?.clientesAsignados.toLocaleString() ?? 0}
          icon={<ClipboardList className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Disponibles"
          value={data?.clientesDisponibles.toLocaleString() ?? 0}
          icon={<CheckCircle className="w-5 h-5" />}
          color="orange"
        />
        <StatCard
          title="Promotores Activos"
          value={data?.totalPromotores ?? 0}
          icon={<Users className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Lotes Hoy"
          value={data?.lotesHoy ?? 0}
          icon={<ClipboardList className="w-5 h-5" />}
          color="blue"
        />
      </div>

      <h2 className="text-lg font-semibold text-slate-100 mb-3">
        Datos trabajados hoy por equipo
      </h2>
      <DataTable
        data={data?.porEquipo ?? []}
        columns={columns}
        pageSize={10}
        pageSizeOptions={[10, 25]}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );
}
