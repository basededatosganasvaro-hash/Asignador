"use client";
import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Solicitud {
  id: number;
  convenio: string;
  nombre_cliente: string | null;
  nss: string | null;
  curp: string | null;
  rfc: string | null;
  numero_empleado: string | null;
  fecha_solicitud: string | null;
  imss_capacidad_actual: number | null;
  imss_num_creditos: number | null;
  imss_telefonos: string | null;
  respuesta: string | null;
}

export default function CapacidadesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<Solicitud | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/promotor/capacidades");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al cargar");
      }
      setSolicitudes(data.solicitudes || []);
      setMensaje(data.mensaje || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar solicitudes";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: ColumnDef<Solicitud, unknown>[] = [
    {
      accessorKey: "fecha_solicitud",
      header: "Fecha",
      size: 140,
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        if (!value) return "—";
        return new Date(value).toLocaleDateString("es-MX", {
          day: "2-digit", month: "short", year: "numeric",
        });
      },
    },
    { accessorKey: "convenio", header: "Convenio", size: 120 },
    {
      accessorKey: "nombre_cliente",
      header: "Cliente",
      size: 180,
      cell: ({ getValue }) => (
        <span className="font-medium text-slate-200 truncate">
          {(getValue() as string) || "—"}
        </span>
      ),
    },
    { accessorKey: "nss", header: "NSS", size: 130 },
    { accessorKey: "curp", header: "CURP", size: 180 },
    {
      accessorKey: "imss_capacidad_actual",
      header: "Capacidad",
      size: 130,
      cell: ({ getValue }) => (
        <span className="font-semibold text-green-400">
          {getValue() != null
            ? Number(getValue()).toLocaleString("es-MX", { style: "currency", currency: "MXN" })
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "imss_num_creditos",
      header: "Creditos",
      size: 100,
    },
    { accessorKey: "imss_telefonos", header: "Telefonos", size: 140 },
    {
      id: "estado",
      header: "Estado",
      size: 120,
      cell: () => (
        <Badge color="green">
          <CheckCircle className="w-3 h-3" />
          Respondida
        </Badge>
      ),
    },
    {
      accessorKey: "respuesta",
      header: "Respuesta",
      minSize: 200,
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        return (
          <span className="text-xs text-slate-500 truncate">
            {val ? (val.length > 80 ? val.substring(0, 80) + "..." : val) : "—"}
          </span>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center mt-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-100">Capacidades Solicitadas</h1>
        <p className="text-sm text-slate-500">
          Historial de solicitudes de capacidad IMSS respondidas
        </p>
      </div>

      {mensaje && (
        <Alert variant="info" className="mb-4">{mensaje}</Alert>
      )}

      {/* Card resumen */}
      <div className="flex gap-3 mb-6">
        <div className="px-6 py-4 rounded-xl text-center bg-green-500 text-white min-w-[160px] border-2 border-green-500">
          <p className="text-xs font-semibold text-white/85">
            Total Respondidas
          </p>
          <p className="text-4xl font-extrabold leading-tight">
            {solicitudes.length}
          </p>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        data={solicitudes}
        columns={columns}
        pageSize={25}
        pageSizeOptions={[25, 50, 100]}
        emptyMessage="Sin solicitudes respondidas"
        onRowClick={(row) => setSelectedRow(row)}
      />

      {/* Dialog: Respuesta completa */}
      <Dialog
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        maxWidth="lg"
      >
        {selectedRow && (
          <>
            <DialogHeader onClose={() => setSelectedRow(null)}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex-1">
                  {selectedRow.nombre_cliente || "Solicitud"} — {selectedRow.convenio}
                </span>
                <Badge color="green">
                  <CheckCircle className="w-3 h-3" />
                  Respondida
                </Badge>
              </div>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-slate-500 mb-4">
                {selectedRow.fecha_solicitud
                  ? new Date(selectedRow.fecha_solicitud).toLocaleDateString("es-MX", {
                      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })
                  : ""}
              </p>

              <div className="flex gap-6 flex-wrap mb-4">
                {selectedRow.nss && <InfoChip label="NSS" value={selectedRow.nss} />}
                {selectedRow.curp && <InfoChip label="CURP" value={selectedRow.curp} />}
                {selectedRow.rfc && <InfoChip label="RFC" value={selectedRow.rfc} />}
                {selectedRow.numero_empleado && <InfoChip label="No. Empleado" value={selectedRow.numero_empleado} />}
                {selectedRow.imss_capacidad_actual != null && (
                  <InfoChip
                    label="Capacidad"
                    value={Number(selectedRow.imss_capacidad_actual).toLocaleString("es-MX", {
                      style: "currency", currency: "MXN",
                    })}
                  />
                )}
                {selectedRow.imss_num_creditos != null && (
                  <InfoChip label="Creditos" value={String(selectedRow.imss_num_creditos)} />
                )}
                {selectedRow.imss_telefonos && (
                  <InfoChip label="Telefonos" value={selectedRow.imss_telefonos} />
                )}
              </div>

              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Respuesta completa
              </p>
              <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/40 whitespace-pre-wrap font-mono text-[13px] text-slate-300 max-h-[400px] overflow-auto">
                {selectedRow.respuesta || "Sin respuesta"}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRow(null)}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}
