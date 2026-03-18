"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { UserPlus, Inbox } from "lucide-react";

interface ClienteData {
  id: number;
  nss?: string;
  curp?: string;
  nombres?: string;
  a_paterno?: string;
  a_materno?: string;
  tel_1?: string;
  capacidad?: string;
  percepciones_fijas?: string;
  descuentos_terceros?: string;
  convenio?: string;
  estado?: string;
  municipio?: string;
  estatus_laboral?: string;
  fecha_ingreso?: string;
  estatus_calificacion?: string;
}

interface PoolItem {
  id: number;
  cliente_id: number;
  calificado_por_nombre: string;
  expira_at: string;
  created_at: string;
  cliente: ClienteData | null;
}

interface Promotor {
  id: number;
  nombre: string;
}

export default function PoolCalificadosPage() {
  const [items, setItems] = useState<PoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promotorId, setPromotorId] = useState("");
  const [asignando, setAsignando] = useState(false);
  const { toast } = useToast();

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch("/api/gerente/pool-analista");
      if (!res.ok) throw new Error("Error al cargar pool");
      const data = await res.json();
      setItems(data.items);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleOpenAsignar = async () => {
    if (selected.size === 0) {
      toast("Selecciona al menos un registro", "error");
      return;
    }
    try {
      const res = await fetch("/api/admin/usuarios/promotores");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPromotores(data);
      setDialogOpen(true);
    } catch {
      toast("Error al cargar promotores", "error");
    }
  };

  const handleAsignar = async () => {
    if (!promotorId) {
      toast("Selecciona un promotor", "error");
      return;
    }

    setAsignando(true);
    try {
      const res = await fetch("/api/gerente/pool-analista/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pool_ids: Array.from(selected),
          promotor_id: Number(promotorId),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast(`${data.asignados} registros asignados a ${data.promotor}`, "success");
        setDialogOpen(false);
        setSelected(new Set());
        setPromotorId("");
        fetchPool();
      } else {
        const data = await res.json();
        toast(data.error || "Error al asignar", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setAsignando(false);
  };

  const columns: ColumnDef<PoolItem, unknown>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={items.length > 0 && selected.size === items.length}
          onChange={toggleAll}
          className="rounded border-slate-600"
        />
      ),
      size: 40,
      enableSorting: false,
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selected.has(row.original.id)}
          onChange={() => toggleSelect(row.original.id)}
          className="rounded border-slate-600"
        />
      ),
    },
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
      id: "curp",
      header: "CURP",
      size: 180,
      accessorFn: (row) => row.cliente?.curp ?? "—",
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
      size: 150,
      accessorFn: (row) => row.cliente?.convenio ?? "—",
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
      header: "Capacidad",
      size: 130,
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
      header: "Estatus Laboral",
      size: 130,
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
      id: "estatus_calificacion",
      header: "Estatus",
      size: 120,
      accessorFn: (row) => row.cliente?.estatus_calificacion ?? "—",
      cell: ({ getValue }) => {
        const val = getValue() as string;
        if (val === "—") return <span className="text-slate-500">—</span>;
        return (
          <Badge color={val === "Localizado" ? "green" : "red"}>
            {val}
          </Badge>
        );
      },
    },
    {
      id: "calificado_por",
      header: "Calificado por",
      size: 140,
      accessorFn: (row) => row.calificado_por_nombre,
    },
    {
      id: "expira",
      header: "Expira",
      size: 110,
      accessorFn: (row) => row.expira_at,
      cell: ({ getValue }) => {
        const date = new Date(getValue() as string);
        return (
          <span className="text-xs text-slate-500">
            {date.toLocaleDateString("es-MX")}
          </span>
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">Pool de Calificados</h1>
          <p className="text-sm text-slate-500 mt-1">
            Clientes calificados por analistas, listos para asignar a promotores
          </p>
        </div>
        <Button
          variant="primary"
          icon={<UserPlus className="w-4 h-4" />}
          onClick={handleOpenAsignar}
          disabled={selected.size === 0}
        >
          Asignar ({selected.size})
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <Inbox className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-400">Pool vacío</h2>
          <p className="text-slate-500">No hay registros calificados disponibles en tu región.</p>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <Badge color="blue">{items.length} disponibles</Badge>
            {selected.size > 0 && (
              <Badge color="amber">{selected.size} seleccionados</Badge>
            )}
          </div>
          <DataTable
            data={items}
            columns={columns}
            loading={false}
            pageSize={25}
            pageSizeOptions={[25, 50, 100]}
          />
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          Asignar a Promotor
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-slate-300">
            Se crearán <strong className="text-amber-400">{selected.size}</strong> oportunidades
            para el promotor seleccionado.
          </p>
          <Select
            label="Promotor"
            value={promotorId}
            onChange={(e) => setPromotorId(e.target.value)}
            placeholder="Selecciona un promotor"
            options={promotores.map((p) => ({
              value: String(p.id),
              label: p.nombre,
            }))}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleAsignar} disabled={asignando || !promotorId}>
            {asignando ? "Asignando..." : "Asignar"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
