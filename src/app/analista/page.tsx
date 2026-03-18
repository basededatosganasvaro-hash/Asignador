"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/Input";
import { Clock, Send } from "lucide-react";

interface ClienteData {
  id: number;
  curp?: string;
  nombres?: string;
  a_paterno?: string;
  a_materno?: string;
  tel_1?: string;
  capacidad?: string;
  percepciones_fijas?: string;
  descuentos_terceros?: string;
  estatus_laboral?: string;
  fecha_ingreso?: string;
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
  const [formEstatus, setFormEstatus] = useState("");
  const [formFechaIngreso, setFormFechaIngreso] = useState("");
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
    setFormEstatus(item.cliente?.estatus_laboral || "");
    setFormFechaIngreso(item.cliente?.fecha_ingreso || "");
  };

  const handleSaveCalificacion = async () => {
    if (!editItem) return;
    if (!formCapacidad.trim()) {
      toast("La capacidad es requerida", "error");
      return;
    }

    const numVal = parseFloat(formCapacidad);
    if (isNaN(numVal) || numVal < 0) {
      toast("La capacidad debe ser un monto válido", "error");
      return;
    }
    if (!formEstatus) {
      toast("El estatus es requerido", "error");
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(formFechaIngreso)) {
      toast("La fecha debe tener formato dd/mm/aaaa", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/analista/calificar/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacidad: numVal.toFixed(2),
          tel_1: formTel.trim() || undefined,
          estatus_laboral: formEstatus,
          fecha_ingreso: formFechaIngreso,
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
      cell: ({ row, getValue }) => {
        const val = getValue() as string;
        return (
          <button
            onClick={() => handleOpenEdit(row.original)}
            className="text-left text-amber-400 hover:text-amber-300 hover:underline transition-colors"
          >
            {val}
          </button>
        );
      },
    },
    {
      id: "curp",
      header: "CURP",
      size: 180,
      accessorFn: (row) => row.cliente?.curp ?? "—",
    },
    {
      id: "percepciones_fijas",
      header: "Percepciones Fijas",
      size: 150,
      accessorFn: (row) => row.cliente?.percepciones_fijas ?? "—",
      cell: ({ getValue }) => {
        const val = getValue() as string;
        if (val === "—") return <span className="text-slate-500">—</span>;
        const num = parseFloat(val);
        return (
          <span className="text-slate-200">
            {isNaN(num) ? val : `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        );
      },
    },
    {
      id: "descuentos_terceros",
      header: "Descuentos Terceros",
      size: 160,
      accessorFn: (row) => row.cliente?.descuentos_terceros ?? "—",
      cell: ({ getValue }) => {
        const val = getValue() as string;
        if (val === "—") return <span className="text-slate-500">—</span>;
        const num = parseFloat(val);
        return (
          <span className="text-slate-200">
            {isNaN(num) ? val : `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        );
      },
    },
    {
      id: "capacidad",
      header: "Capacidad (MXN)",
      size: 160,
      accessorFn: (row) => row.cliente?.capacidad ?? "—",
      cell: ({ getValue }) => {
        const val = getValue() as string;
        if (val === "—") return <span className="text-slate-500">—</span>;
        const num = parseFloat(val);
        return (
          <span className="text-amber-400 font-medium">
            {isNaN(num) ? val : `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        );
      },
    },
    {
      id: "estatus_laboral",
      header: "Estatus",
      size: 110,
      accessorFn: (row) => row.cliente?.estatus_laboral ?? "—",
      cell: ({ getValue }) => {
        const val = getValue() as string;
        if (val === "—") return <span className="text-slate-500">—</span>;
        return (
          <Badge color={val === "Estable" ? "green" : "amber"}>
            {val}
          </Badge>
        );
      },
    },
    {
      id: "fecha_ingreso",
      header: "Fecha Ingreso",
      size: 120,
      accessorFn: (row) => row.cliente?.fecha_ingreso ?? "—",
    },
    {
      id: "tel_1",
      header: "Teléfono",
      size: 130,
      accessorFn: (row) => row.cliente?.tel_1 ?? "—",
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
                CURP: {editItem.cliente.curp ?? "—"}
              </p>
            </div>
          )}
          <Input
            label="Capacidad (MXN)"
            type="number"
            step="0.01"
            min="0"
            value={formCapacidad}
            onChange={(e) => setFormCapacidad(e.target.value)}
            required
            placeholder="Ej: 50000.00"
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Estatus <span className="text-red-400">*</span>
            </label>
            <select
              value={formEstatus}
              onChange={(e) => setFormEstatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="">Seleccionar...</option>
              <option value="Estable">Estable</option>
              <option value="No estable">No estable</option>
            </select>
          </div>
          <Input
            label="Fecha de Ingreso (dd/mm/aaaa)"
            value={formFechaIngreso}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d/]/g, "");
              setFormFechaIngreso(v);
            }}
            maxLength={10}
            required
            placeholder="dd/mm/aaaa"
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
