"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2 } from "lucide-react";

interface PlanTrabajo {
  id: number;
  convenio: string;
  activo: boolean;
  created_at: string;
  zona: { id: number; nombre: string };
  creador: { id: number; nombre: string };
}

interface Zona {
  id: number;
  nombre: string;
}

export default function PlanesTrabajoPage() {
  const [rows, setRows] = useState<PlanTrabajo[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ zona_id: "", convenio: "" });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [p, z] = await Promise.all([
        fetch("/api/admin/planes-trabajo").then((res) => res.json()),
        fetch("/api/admin/organizacion/zonas").then((res) => res.json()),
      ]);
      setRows(p);
      setZonas(z);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    const res = await fetch("/api/admin/planes-trabajo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zona_id: Number(form.zona_id), convenio: form.convenio }),
    });
    if (res.ok) {
      setDialogOpen(false);
      setForm({ zona_id: "", convenio: "" });
      toast("Plan de trabajo creado", "success");
      fetchData();
    } else {
      const data = await res.json();
      toast(data.error || "Error al crear", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar este plan de trabajo?")) return;
    const res = await fetch("/api/admin/planes-trabajo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast("Plan eliminado", "success");
      fetchData();
    }
  };

  const columns: ColumnDef<PlanTrabajo, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "convenio",
        header: "Convenio",
      },
      {
        id: "zona",
        header: "Zona",
        accessorFn: (row) => row.zona?.nombre ?? "\u2014",
      },
      {
        id: "creador",
        header: "Creado por",
        size: 160,
        accessorFn: (row) => row.creador?.nombre ?? "\u2014",
      },
      {
        id: "created_at",
        header: "Fecha",
        size: 120,
        accessorFn: (row) => new Date(row.created_at).toLocaleDateString("es-MX"),
      },
      {
        id: "actions",
        header: "Acciones",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={() => handleDelete(row.original.id)}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ),
      },
    ],
    []
  );

  const zonaOptions = zonas.map((z) => ({ value: String(z.id), label: z.nombre }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl font-bold text-slate-100">Planes de Trabajo</h1>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setDialogOpen(true)}
        >
          Nuevo Plan
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        pageSize={10}
        pageSizeOptions={[10, 25]}
        emptyMessage="No hay planes de trabajo"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          Nuevo Plan de Trabajo
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Select
            label="Zona"
            value={form.zona_id}
            onChange={(e) => setForm({ ...form, zona_id: e.target.value })}
            options={zonaOptions}
            placeholder="Seleccionar zona..."
          />
          <Input
            label="Convenio"
            value={form.convenio}
            onChange={(e) => setForm({ ...form, convenio: e.target.value })}
            required
            autoFocus
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="danger" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={!form.zona_id || !form.convenio}>
            Crear
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
