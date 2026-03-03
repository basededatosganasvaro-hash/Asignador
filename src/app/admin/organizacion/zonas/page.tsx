"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Ban, CheckCircle } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

interface Zona {
  id: number;
  nombre: string;
  activo: boolean;
  region: { id: number; nombre: string };
  _count: { sucursales: number };
}

interface Region { id: number; nombre: string; }

export default function ZonasPage() {
  const [rows, setRows] = useState<Zona[]>([]);
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Zona | null>(null);
  const [form, setForm] = useState({ nombre: "", region_id: "" });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [z, r] = await Promise.all([
        fetch("/api/admin/organizacion/zonas").then((res) => res.json()),
        fetch("/api/admin/organizacion/regiones").then((res) => res.json()),
      ]);
      setRows(z);
      setRegiones(r);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexión", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenCreate = () => { setEditing(null); setForm({ nombre: "", region_id: "" }); setDialogOpen(true); };
  const handleOpenEdit = (row: Zona) => { setEditing(row); setForm({ nombre: row.nombre, region_id: String(row.region.id) }); setDialogOpen(true); };

  const handleSave = async () => {
    const url = editing ? `/api/admin/organizacion/zonas/${editing.id}` : "/api/admin/organizacion/zonas";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: form.nombre, region_id: Number(form.region_id) }) });
    if (res.ok) {
      setDialogOpen(false);
      toast(editing ? "Zona actualizada" : "Zona creada", "success");
      fetchData();
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  const handleToggle = async (row: Zona) => {
    const res = await fetch(`/api/admin/organizacion/zonas/${row.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !row.activo }),
    });
    if (res.ok) { toast(row.activo ? "Desactivada" : "Activada", "success"); fetchData(); }
  };

  const columns: ColumnDef<Zona, unknown>[] = [
    { accessorKey: "nombre", header: "Nombre", cell: ({ getValue }) => <span className="font-medium text-slate-100">{getValue() as string}</span> },
    { id: "region", header: "Región", cell: ({ row }) => <span>{row.original.region?.nombre ?? "—"}</span> },
    { id: "sucursales", header: "Sucursales", cell: ({ row }) => <span className="text-center block">{row.original._count?.sucursales ?? 0}</span> },
    {
      accessorKey: "activo", header: "Estado",
      cell: ({ getValue }) => <Badge color={getValue() ? "green" : "slate"}>{getValue() ? "Activo" : "Inactivo"}</Badge>,
    },
    {
      id: "actions", header: "Acciones", enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => handleOpenEdit(row.original)} className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Editar">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => handleToggle(row.original)} className={`p-1.5 rounded-lg transition-colors ${row.original.activo ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"}`} title={row.original.activo ? "Desactivar" : "Activar"}>
            {row.original.activo ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-xl font-bold text-slate-100">Zonas</h1>
        <Button icon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>Nueva Zona</Button>
      </div>

      <DataTable data={rows} columns={columns} loading={loading} pageSize={10} pageSizeOptions={[10, 25]} getRowId={(row) => String(row.id)} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          {editing ? "Editar Zona" : "Nueva Zona"}
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required autoFocus />
          <Select
            label="Región"
            value={form.region_id}
            onChange={(e) => setForm({ ...form, region_id: e.target.value })}
            options={regiones.map((r) => ({ value: String(r.id), label: r.nombre }))}
            placeholder="Seleccionar..."
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre || !form.region_id}>{editing ? "Actualizar" : "Crear"}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
