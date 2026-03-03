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

interface Sucursal {
  id: number;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  zona: { id: number; nombre: string; region: { id: number; nombre: string } };
  _count: { equipos: number; usuarios: number };
}

interface Zona { id: number; nombre: string; region: { nombre: string }; }

export default function SucursalesPage() {
  const [rows, setRows] = useState<Sucursal[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sucursal | null>(null);
  const [form, setForm] = useState({ nombre: "", zona_id: "", direccion: "" });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [s, z] = await Promise.all([
        fetch("/api/admin/organizacion/sucursales").then((res) => res.json()),
        fetch("/api/admin/organizacion/zonas").then((res) => res.json()),
      ]);
      setRows(s);
      setZonas(z);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexión", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenCreate = () => { setEditing(null); setForm({ nombre: "", zona_id: "", direccion: "" }); setDialogOpen(true); };
  const handleOpenEdit = (row: Sucursal) => {
    setEditing(row);
    setForm({ nombre: row.nombre, zona_id: String(row.zona.id), direccion: row.direccion ?? "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editing ? `/api/admin/organizacion/sucursales/${editing.id}` : "/api/admin/organizacion/sucursales";
    const method = editing ? "PUT" : "POST";
    const body = { nombre: form.nombre, zona_id: Number(form.zona_id), ...(form.direccion && { direccion: form.direccion }) };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setDialogOpen(false);
      toast(editing ? "Sucursal actualizada" : "Sucursal creada", "success");
      fetchData();
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  const handleToggle = async (row: Sucursal) => {
    const res = await fetch(`/api/admin/organizacion/sucursales/${row.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !row.activo }),
    });
    if (res.ok) { toast(row.activo ? "Desactivada" : "Activada", "success"); fetchData(); }
  };

  const columns: ColumnDef<Sucursal, unknown>[] = [
    { accessorKey: "nombre", header: "Nombre", cell: ({ getValue }) => <span className="font-medium text-slate-100">{getValue() as string}</span> },
    { id: "zona", header: "Zona", cell: ({ row }) => <span>{row.original.zona?.nombre ?? "—"}</span> },
    { id: "region", header: "Región", cell: ({ row }) => <span>{row.original.zona?.region?.nombre ?? "—"}</span> },
    { id: "equipos", header: "Equipos", cell: ({ row }) => <span className="text-center block">{row.original._count?.equipos ?? 0}</span> },
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
        <h1 className="font-display text-xl font-bold text-slate-100">Sucursales</h1>
        <Button icon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>Nueva Sucursal</Button>
      </div>

      <DataTable data={rows} columns={columns} loading={loading} pageSize={10} pageSizeOptions={[10, 25]} getRowId={(row) => String(row.id)} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          {editing ? "Editar Sucursal" : "Nueva Sucursal"}
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required autoFocus />
          <Select
            label="Zona"
            value={form.zona_id}
            onChange={(e) => setForm({ ...form, zona_id: e.target.value })}
            options={zonas.map((z) => ({ value: String(z.id), label: `${z.nombre} — ${z.region.nombre}` }))}
            placeholder="Seleccionar..."
          />
          <Input label="Dirección (opcional)" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre || !form.zona_id}>{editing ? "Actualizar" : "Crear"}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
