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

interface Equipo {
  id: number;
  nombre: string;
  activo: boolean;
  sucursal: { id: number; nombre: string } | null;
  supervisor: { id: number; nombre: string } | null;
  _count: { miembros: number };
}

interface Sucursal { id: number; nombre: string; }
interface Supervisor { id: number; nombre: string; }

export default function EquiposPage() {
  const [rows, setRows] = useState<Equipo[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipo | null>(null);
  const [form, setForm] = useState({ nombre: "", sucursal_id: "", supervisor_id: "" });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [e, s, u] = await Promise.all([
        fetch("/api/admin/organizacion/equipos").then((res) => res.json()),
        fetch("/api/admin/organizacion/sucursales").then((res) => res.json()),
        fetch("/api/admin/usuarios").then((res) => res.json()),
      ]);
      setRows(e);
      setSucursales(s);
      setSupervisores(u.filter((u: { rol: string }) => u.rol === "supervisor"));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexión", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenCreate = () => { setEditing(null); setForm({ nombre: "", sucursal_id: "", supervisor_id: "" }); setDialogOpen(true); };
  const handleOpenEdit = (row: Equipo) => {
    setEditing(row);
    setForm({ nombre: row.nombre, sucursal_id: row.sucursal ? String(row.sucursal.id) : "", supervisor_id: row.supervisor ? String(row.supervisor.id) : "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editing ? `/api/admin/organizacion/equipos/${editing.id}` : "/api/admin/organizacion/equipos";
    const method = editing ? "PUT" : "POST";
    const body = {
      nombre: form.nombre,
      sucursal_id: form.sucursal_id ? Number(form.sucursal_id) : null,
      supervisor_id: form.supervisor_id ? Number(form.supervisor_id) : null,
    };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setDialogOpen(false);
      toast(editing ? "Equipo actualizado" : "Equipo creado", "success");
      fetchData();
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  const handleToggle = async (row: Equipo) => {
    const res = await fetch(`/api/admin/organizacion/equipos/${row.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !row.activo }),
    });
    if (res.ok) { toast(row.activo ? "Desactivado" : "Activado", "success"); fetchData(); }
  };

  const columns: ColumnDef<Equipo, unknown>[] = [
    { accessorKey: "nombre", header: "Nombre", cell: ({ getValue }) => <span className="font-medium text-slate-100">{getValue() as string}</span> },
    { id: "sucursal", header: "Sucursal", cell: ({ row }) => <span>{row.original.sucursal?.nombre ?? "—"}</span> },
    { id: "supervisor", header: "Supervisor", cell: ({ row }) => <span>{row.original.supervisor?.nombre ?? "Sin supervisor"}</span> },
    { id: "miembros", header: "Miembros", cell: ({ row }) => <span className="text-center block">{row.original._count?.miembros ?? 0}</span> },
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
        <h1 className="font-display text-xl font-bold text-slate-100">Equipos</h1>
        <Button icon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>Nuevo Equipo</Button>
      </div>

      <DataTable data={rows} columns={columns} loading={loading} pageSize={10} pageSizeOptions={[10, 25]} getRowId={(row) => String(row.id)} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          {editing ? "Editar Equipo" : "Nuevo Equipo"}
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required autoFocus />
          <Select
            label="Sucursal (opcional)"
            value={form.sucursal_id}
            onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
            options={sucursales.map((s) => ({ value: String(s.id), label: s.nombre }))}
            placeholder="Sin sucursal"
          />
          <Select
            label="Supervisor (opcional)"
            value={form.supervisor_id}
            onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}
            options={supervisores.map((s) => ({ value: String(s.id), label: s.nombre }))}
            placeholder="Sin supervisor"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nombre}>{editing ? "Actualizar" : "Crear"}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
