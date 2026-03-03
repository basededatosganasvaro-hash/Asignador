"use client";
import { useEffect, useState } from "react";
import { Database, ClipboardList, CheckCircle, Users } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import StatCard from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";

interface DashboardData {
  totalClientes: number;
  clientesAsignados: number;
  clientesDisponibles: number;
  totalPromotores: number;
  lotesHoy: number;
  porPromotor: {
    id: number;
    nombre: string;
    total_lotes: number;
    total_asignados: number;
    oportunidades_activas: number;
  }[];
}

type PromotorRow = DashboardData["porPromotor"][number];

const columns: ColumnDef<PromotorRow, unknown>[] = [
  { accessorKey: "nombre", header: "Promotor" },
  {
    accessorKey: "total_lotes",
    header: "Lotes",
    cell: ({ getValue }) => <span className="text-center block">{getValue() as number}</span>,
    meta: { align: "center" },
  },
  {
    accessorKey: "total_asignados",
    header: "Asignados",
    cell: ({ getValue }) => <span className="text-center block">{getValue() as number}</span>,
  },
  {
    accessorKey: "oportunidades_activas",
    header: "Activas",
    cell: ({ getValue }) => <span className="text-center block">{getValue() as number}</span>,
  },
];

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
        Resumen por Promotor
      </h2>
      <DataTable
        data={data?.porPromotor ?? []}
        columns={columns}
        pageSize={10}
        pageSizeOptions={[10, 25]}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );
}
