"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Download, Folder, Users, Phone, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { Spinner } from "@/components/ui/Spinner";
import { LinearProgress } from "@/components/ui/LinearProgress";
import { DataTable } from "@/components/ui/DataTable";
import StatCard from "@/components/ui/StatCard";

interface Asignacion {
  id: number;
  fecha: string;
  cantidad: number;
  estado: string;
  oportunidades_activas: number;
  registros_con_tel1: number;
  puede_descargar: boolean;
}

export default function AsignacionesPage() {
  const router = useRouter();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetch("/api/asignaciones")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setAsignaciones(data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = (id: number) => {
    window.open(`/api/asignaciones/${id}/excel`, "_blank");
  };

  const stats = useMemo(() => {
    const totalRegistros = asignaciones.reduce((s, a) => s + a.cantidad, 0);
    const conTelefono = asignaciones.reduce((s, a) => s + a.registros_con_tel1, 0);
    const completados = asignaciones.filter((a) => a.puede_descargar).length;
    return { totalRegistros, conTelefono, completados };
  }, [asignaciones]);

  const columns: ColumnDef<Asignacion, unknown>[] = [
    {
      accessorKey: "id",
      header: "Lote",
      size: 80,
      cell: ({ getValue }) => (
        <Badge color="slate">#{String(getValue())}</Badge>
      ),
    },
    {
      accessorKey: "fecha",
      header: "Fecha",
      size: 130,
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("es-MX"),
    },
    {
      accessorKey: "cantidad",
      header: "Registros",
      size: 110,
      cell: ({ getValue }) => (
        <span className="font-semibold text-slate-200">{String(getValue())}</span>
      ),
    },
    {
      id: "progreso",
      header: "Progreso Tel.",
      size: 200,
      cell: ({ row }) => {
        const r = row.original;
        const pct = r.cantidad > 0 ? (r.registros_con_tel1 / r.cantidad) * 100 : 0;
        return (
          <div className="flex items-center gap-2 w-full">
            <LinearProgress
              value={pct}
              color={pct === 100 ? "green" : "blue"}
              className="flex-1"
            />
            <span className="text-xs font-semibold text-slate-400 min-w-[50px] text-right">
              {r.registros_con_tel1}/{r.cantidad}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "oportunidades_activas",
      header: "Activas",
      size: 100,
      cell: ({ getValue }) => {
        const val = getValue() as number;
        return (
          <Badge color={val === 0 ? "slate" : "blue"}>
            {val}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex gap-1 justify-end">
            <Tooltip content="Ver detalle">
              <button
                className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                onClick={() => router.push(`/promotor/asignaciones/${r.id}`)}
              >
                <Eye className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content={r.puede_descargar ? "Descargar Excel" : "Completa todos los telefonos para descargar"}>
              <button
                className={`p-1.5 rounded-lg transition-colors ${
                  r.puede_descargar
                    ? "text-green-400 hover:bg-green-500/10"
                    : "text-slate-600 cursor-not-allowed"
                }`}
                disabled={!r.puede_descargar}
                onClick={() => handleDownload(r.id)}
              >
                <Download className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  if (loading) return (
    <div className="flex justify-center mt-16"><Spinner /></div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Mis Asignaciones</h1>
        <p className="text-sm text-slate-500">
          {asignaciones.length} lote{asignaciones.length !== 1 ? "s" : ""} asignado{asignaciones.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total Lotes" value={asignaciones.length} icon={<Folder className="w-5 h-5" />} color="blue" />
        <StatCard title="Total Registros" value={stats.totalRegistros} icon={<Users className="w-5 h-5" />} color="blue" />
        <StatCard title="Con Telefono" value={stats.conTelefono} icon={<Phone className="w-5 h-5" />} color="green" />
        <StatCard title="Listos para Excel" value={stats.completados} icon={<CheckCircle className="w-5 h-5" />} color="green" />
      </div>

      {fetchError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          Error al cargar asignaciones. Intenta recargar la pagina.
        </div>
      )}

      {/* DataTable */}
      <DataTable
        data={asignaciones}
        columns={columns}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        emptyMessage="Aun no tienes asignaciones. Solicita una desde el Dashboard."
      />
    </div>
  );
}
