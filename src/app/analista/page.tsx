"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle, Clock, Send, Pencil, X, Save } from "lucide-react";

interface ClienteData {
  id: number;
  rfc?: string;
  nombres?: string;
  a_paterno?: string;
  a_materno?: string;
  tel_1?: string;
  capacidad?: string;
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
  const [editingId, setEditingId] = useState<number | null>(null);
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

  const handleStartEdit = (item: CalificacionItem) => {
    setEditingId(item.id);
    setFormCapacidad(item.cliente?.capacidad || "");
    setFormTel(item.cliente?.tel_1 || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormCapacidad("");
    setFormTel("");
  };

  const handleSaveCalificacion = async (itemId: number) => {
    if (!formCapacidad.trim()) {
      toast("La capacidad es requerida", "error");
      return;
    }

    const numVal = parseFloat(formCapacidad);
    if (isNaN(numVal) || numVal < 0) {
      toast("La capacidad debe ser un monto válido", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/analista/calificar/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacidad: numVal.toFixed(2),
          tel_1: formTel.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast("Registro calificado", "success");
        setEditingId(null);
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
      id: "rfc",
      header: "RFC",
      size: 140,
      accessorFn: (row) => row.cliente?.rfc ?? "—",
    },
    {
      id: "capacidad",
      header: "Capacidad (MXN)",
      size: 160,
      accessorFn: (row) => row.cliente?.capacidad ?? "—",
      cell: ({ row }) => {
        const item = row.original;
        if (editingId === item.id) {
          return (
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formCapacidad}
                onChange={(e) => setFormCapacidad(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveCalificacion(item.id);
                  if (e.key === "Escape") handleCancelEdit();
                }}
                autoFocus
                className="w-28 px-2 py-1 bg-slate-800 border border-amber-500/50 rounded text-sm text-slate-100 focus:outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          );
        }
        const val = item.cliente?.capacidad;
        if (!val) return <span className="text-slate-500">—</span>;
        const num = parseFloat(val);
        return (
          <span className="text-amber-400 font-medium">
            ${isNaN(num) ? val : num.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      id: "tel_1",
      header: "Teléfono",
      size: 150,
      accessorFn: (row) => row.cliente?.tel_1 ?? "—",
      cell: ({ row }) => {
        const item = row.original;
        if (editingId === item.id) {
          return (
            <input
              type="tel"
              value={formTel}
              onChange={(e) => setFormTel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveCalificacion(item.id);
                if (e.key === "Escape") handleCancelEdit();
              }}
              placeholder="Opcional"
              className="w-32 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 focus:outline-none focus:border-amber-400"
            />
          );
        }
        return <span className={item.cliente?.tel_1 ? "text-slate-200" : "text-slate-500"}>{item.cliente?.tel_1 ?? "—"}</span>;
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
      size: 100,
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        if (editingId === item.id) {
          return (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSaveCalificacion(item.id)}
                disabled={saving}
                title="Guardar"
                className="p-1.5 text-green-400 hover:text-green-300 hover:bg-slate-800/60 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                title="Cancelar"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800/60 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        }
        return (
          <button
            onClick={() => handleStartEdit(item)}
            title={item.calificado ? "Editar calificación" : "Calificar"}
            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            {item.calificado ? (
              <Pencil className="w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
          </button>
        );
      },
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
