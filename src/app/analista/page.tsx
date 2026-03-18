"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle, Clock, Send, Pencil } from "lucide-react";

interface ClienteData {
  id: number;
  nss?: string;
  curp?: string;
  nombres?: string;
  a_paterno?: string;
  a_materno?: string;
  tel_1?: string;
  capacidad?: string;
  convenio?: string;
  estado?: string;
  municipio?: string;
}

interface CalificacionItem {
  id: number;
  cliente_id: number;
  calificado: boolean;
  cliente: ClienteData | null;
}

interface LoteInfo {
  id: number;
  fecha: string;
  cantidad: number;
  estado: string;
  total_calificados: number;
  total_pendientes: number;
}

export default function AnalistaPage() {
  const [lote, setLote] = useState<LoteInfo | null>(null);
  const [clientes, setClientes] = useState<CalificacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<CalificacionItem | null>(null);
  const [formCapacidad, setFormCapacidad] = useState("");
  const [formTel, setFormTel] = useState("");
  const [saving, setSaving] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [confirmFinalizar, setConfirmFinalizar] = useState(false);
  const { toast } = useToast();

  const fetchLote = useCallback(async () => {
    try {
      const res = await fetch("/api/analista/mi-lote");
      if (!res.ok) throw new Error("Error al cargar lote");
      const data = await res.json();
      setLote(data.lote);
      setClientes(data.clientes);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchLote();
  }, [fetchLote]);

  const handleOpenEdit = (item: CalificacionItem) => {
    setEditItem(item);
    setFormCapacidad(item.cliente?.capacidad || "");
    setFormTel(item.cliente?.tel_1 || "");
  };

  const handleSaveCalificacion = async () => {
    if (!editItem) return;
    if (!formCapacidad.trim()) {
      toast("La capacidad es requerida", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/analista/calificar/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacidad: formCapacidad.trim(),
          tel_1: formTel.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast("Registro calificado", "success");
        setEditItem(null);
        fetchLote();
      } else {
        const data = await res.json();
        toast(data.error || "Error al calificar", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setSaving(false);
  };

  const handleFinalizar = async () => {
    setFinalizando(true);
    try {
      const res = await fetch("/api/analista/finalizar-lote", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast(
          `Lote finalizado: ${data.calificados} calificados, ${data.descartados} descartados`,
          "success"
        );
        setConfirmFinalizar(false);
        fetchLote();
      } else {
        const data = await res.json();
        toast(data.error || "Error al finalizar", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setFinalizando(false);
  };

  const columns: ColumnDef<CalificacionItem, unknown>[] = [
    {
      id: "nombre",
      header: "Nombre",
      size: 220,
      accessorFn: (row) => {
        const c = row.cliente;
        if (!c) return "—";
        return [c.nombres, c.a_paterno, c.a_materno].filter(Boolean).join(" ");
      },
    },
    {
      id: "nss",
      header: "NSS",
      size: 120,
      accessorFn: (row) => row.cliente?.nss ?? "—",
    },
    {
      id: "convenio",
      header: "Convenio",
      size: 160,
      accessorFn: (row) => row.cliente?.convenio ?? "—",
    },
    {
      id: "capacidad",
      header: "Capacidad",
      size: 120,
      accessorFn: (row) => row.cliente?.capacidad ?? "—",
      cell: ({ getValue }) => {
        const val = getValue() as string;
        return (
          <span className={val === "—" ? "text-slate-500" : "text-amber-400 font-medium"}>
            {val}
          </span>
        );
      },
    },
    {
      id: "tel_1",
      header: "Teléfono",
      size: 130,
      accessorFn: (row) => row.cliente?.tel_1 ?? "—",
    },
    {
      id: "estado_mun",
      header: "Ubicación",
      size: 160,
      accessorFn: (row) => {
        const c = row.cliente;
        if (!c) return "—";
        return [c.estado, c.municipio].filter(Boolean).join(", ");
      },
    },
    {
      id: "status",
      header: "Estado",
      size: 110,
      cell: ({ row }) => (
        <Badge color={row.original.calificado ? "green" : "slate"}>
          {row.original.calificado ? "Calificado" : "Pendiente"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Acción",
      size: 80,
      enableSorting: false,
      cell: ({ row }) => (
        <button
          onClick={() => handleOpenEdit(row.original)}
          title={row.original.calificado ? "Editar calificación" : "Calificar"}
          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg transition-colors"
        >
          {row.original.calificado ? (
            <Pencil className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="text-center py-20">
        <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-300 mb-2">Sin asignación</h2>
        <p className="text-slate-500">
          No tienes lote asignado. Las asignaciones se realizan automáticamente a las 8:00 AM.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">Mi Lote de Calificación</h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date(lote.fecha).toLocaleDateString("es-MX", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Send className="w-4 h-4" />}
          onClick={() => setConfirmFinalizar(true)}
          disabled={lote.total_calificados === 0}
        >
          Finalizar Lote
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-slate-800/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{lote.cantidad}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-slate-800/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Calificados</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{lote.total_calificados}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-slate-800/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Pendientes</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{lote.total_pendientes}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-slate-800/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Avance</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">
            {lote.cantidad > 0
              ? Math.round((lote.total_calificados / lote.cantidad) * 100)
              : 0}%
          </p>
        </div>
      </div>

      <DataTable
        data={clientes}
        columns={columns}
        loading={false}
        pageSize={25}
        pageSizeOptions={[25, 50, 100]}
      />

      {/* Dialog calificar */}
      <Dialog open={!!editItem} onClose={() => setEditItem(null)} maxWidth="sm">
        <DialogHeader onClose={() => setEditItem(null)}>
          Calificar Registro
        </DialogHeader>
        <DialogBody className="space-y-4">
          {editItem?.cliente && (
            <div className="bg-slate-800/40 rounded-lg p-3 space-y-1">
              <p className="text-sm text-slate-300 font-medium">
                {[editItem.cliente.nombres, editItem.cliente.a_paterno, editItem.cliente.a_materno]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              <p className="text-xs text-slate-500">
                NSS: {editItem.cliente.nss ?? "—"} | Convenio: {editItem.cliente.convenio ?? "—"}
              </p>
            </div>
          )}
          <Input
            label="Capacidad"
            value={formCapacidad}
            onChange={(e) => setFormCapacidad(e.target.value)}
            required
            placeholder="Ej: $50,000"
          />
          <Input
            label="Teléfono (opcional)"
            value={formTel}
            onChange={(e) => setFormTel(e.target.value)}
            placeholder="Ej: 5512345678"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEditItem(null)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSaveCalificacion} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog confirmar finalizar */}
      <Dialog open={confirmFinalizar} onClose={() => setConfirmFinalizar(false)} maxWidth="sm">
        <DialogHeader onClose={() => setConfirmFinalizar(false)}>
          Finalizar Lote
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-slate-300">
            Se enviarán <strong className="text-green-400">{lote.total_calificados}</strong> registros
            calificados al pool del gerente.
            Los <strong className="text-slate-400">{lote.total_pendientes}</strong> pendientes serán
            descartados.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Esta acción no se puede deshacer.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmFinalizar(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleFinalizar} disabled={finalizando}>
            {finalizando ? "Finalizando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
