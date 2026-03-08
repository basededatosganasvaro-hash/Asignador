"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Download } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { LinearProgress } from "@/components/ui/LinearProgress";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";

interface ClienteRow {
  id: number;
  nombres: string | null;
  tel_1: string | null;
  tel_2: string | null;
  tel_3: string | null;
  tel_4: string | null;
  tel_5: string | null;
  curp: string | null;
  rfc: string | null;
  num_empleado: string | null;
  estado: string | null;
  municipio: string | null;
  convenio: string | null;
  oferta: string | null;
  tipo_empleado: string | null;
  tipo_nomina: string | null;
  nivel_salarial: string | null;
  puesto: string | null;
  centro_educativo: string | null;
  clave_cct: string | null;
  oferta_neta: string | null;
  oportunidad_total: string | null;
  oportunidad_real: string | null;
  dependencia: string | null;
  antiguedad: string | null;
  universo: string | null;
  nomb_unidad_adm: string | null;
}

interface AsignacionDetail {
  id: number;
  fecha_asignacion: string;
  cantidad_registros: number;
  estado: string;
  registros_con_tel1: number;
  puede_descargar: boolean;
  registros: ClienteRow[];
}

export default function AsignacionDetallePage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<AsignacionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/asignaciones/${params.id}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      /* error de conexion, data queda null */
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownload = () => {
    window.open(`/api/asignaciones/${params.id}/excel`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-16">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-8">
        <Alert variant="error">Asignacion no encontrada</Alert>
      </div>
    );
  }

  const pct =
    data.cantidad_registros > 0
      ? (data.registros_con_tel1 / data.cantidad_registros) * 100
      : 0;

  const columns: ColumnDef<ClienteRow, unknown>[] = [
    { accessorKey: "nombres", header: "Nombre", minSize: 200 },
    {
      accessorKey: "tel_1",
      header: "Tel 1",
      size: 140,
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        return (
          <span className={!val || val.trim() === "" ? "text-amber-500/70 italic" : "text-slate-200"}>
            {val || "Sin tel"}
          </span>
        );
      },
    },
    { accessorKey: "tel_2", header: "Tel 2", size: 120 },
    { accessorKey: "tel_3", header: "Tel 3", size: 120 },
    { accessorKey: "tel_4", header: "Tel 4", size: 120 },
    { accessorKey: "tel_5", header: "Tel 5", size: 120 },
    { accessorKey: "curp", header: "CURP", size: 180 },
    { accessorKey: "rfc", header: "RFC", size: 160 },
    { accessorKey: "num_empleado", header: "No. Empleado", size: 130 },
    { accessorKey: "estado", header: "Estado", size: 140 },
    { accessorKey: "municipio", header: "Municipio", size: 140 },
    { accessorKey: "convenio", header: "Convenio", size: 200 },
    { accessorKey: "oferta", header: "Oferta", size: 120 },
    { accessorKey: "dependencia", header: "Dependencia", size: 140 },
    { accessorKey: "tipo_empleado", header: "Tipo Empleado", size: 140 },
    { accessorKey: "tipo_nomina", header: "Tipo Nomina", size: 130 },
    { accessorKey: "nivel_salarial", header: "Nivel Salarial", size: 130 },
    { accessorKey: "puesto", header: "Puesto", size: 150 },
    { accessorKey: "antiguedad", header: "Antiguedad", size: 120 },
    { accessorKey: "nomb_unidad_adm", header: "Unidad Adm.", size: 180 },
    { accessorKey: "centro_educativo", header: "Centro Educativo", size: 200 },
    { accessorKey: "clave_cct", header: "Clave CCT", size: 130 },
    { accessorKey: "oferta_neta", header: "Oferta Neta", size: 130 },
    { accessorKey: "oportunidad_total", header: "Oportunidad Total", size: 150 },
    { accessorKey: "oportunidad_real", header: "Oportunidad Real", size: 150 },
  ];

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        icon={<ArrowLeft className="w-4 h-4" />}
        onClick={() => router.push("/promotor/asignaciones")}
        className="mb-4"
      >
        Volver a Asignaciones
      </Button>

      <Card className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">
              Lote #{data.id}
            </h1>
            <p className="text-sm text-slate-500">
              Fecha: {new Date(data.fecha_asignacion).toLocaleDateString("es-MX")}
              {" | "}
              {data.cantidad_registros} registros
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              color={
                data.estado === "activa"
                  ? "blue"
                  : data.estado === "completada"
                    ? "green"
                    : "red"
              }
            >
              {data.estado}
            </Badge>
            <Tooltip
              content={
                data.puede_descargar
                  ? "Descargar Excel con nombres y telefonos"
                  : `Faltan ${data.cantidad_registros - data.registros_con_tel1} telefonos por completar`
              }
            >
              <Button
                variant="primary"
                icon={<Download className="w-4 h-4" />}
                disabled={!data.puede_descargar}
                onClick={handleDownload}
                className={data.puede_descargar ? "!bg-green-600 hover:!bg-green-500 !shadow-green-600/20" : ""}
              >
                Descargar Excel
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-slate-500">
              Progreso de telefonos:
            </span>
            <span className="text-sm font-semibold text-slate-200">
              {data.registros_con_tel1} / {data.cantidad_registros}
            </span>
          </div>
          <LinearProgress
            value={pct}
            color={pct === 100 ? "green" : "blue"}
          />
        </div>
      </Card>

      <p className="text-sm text-slate-500 mb-3">
        Esta tabla es de solo lectura. Para editar telefonos, usa la vista de oportunidades.
      </p>

      <DataTable
        data={data.registros}
        columns={columns}
        pageSize={50}
        pageSizeOptions={[25, 50, 100]}
      />
    </div>
  );
}
