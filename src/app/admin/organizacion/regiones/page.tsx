"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Ban, CheckCircle } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface Region {
  id: number;
  nombre: string;
  activo: boolean;
  _count: { zonas: number; usuarios: number };
}

export default function RegionesPage() {
  const [rows, setRows] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [nombre, setNombre] = useState("");
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/organizacion/regiones");
      if (!res.ok) throw new Error("Error al cargar regiones");
      setRows(await res.json());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexión", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenCreate = () => { setEditing(null); setNombre(""); setDialogOpen(true); };
  const handleOpenEdit = (row: Region) => { setEditing(row); setNombre(row.nombre); setDialogOpen(true); };

  const handleSave = async () => {
    const url = editing ? `/api/admin/organizacion/regiones/${editing.id}` : "/api/admin/organizacion/regiones";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    if (res.ok) {
      setDialogOpen(false);
      toast(editing ? "Región actualizada" : "Región creada", "success");
      fetchData();
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  const handleToggle = async (row: Region) => {
    const res = await fetch(`/api/admin/organizacion/regiones/${row.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !row.activo }),
    });
    if (res.ok) { toast(row.activo ? "Desactivada" : "Activada", "success"); fetchData(); }
  };

  const columns: ColumnDef<Region, unknown>[] = [
    { accessorKey: "nombre", header: "Nombre", cell: ({ getValue }) => <span className="font-medium text-slate-100">{getValue() as string}</span> },
    { id: "zonas", header: "Zonas", cell: ({ row }) => <span className="text-center block">{row.original._count?.zonas ?? 0}</span> },
    { id: "usuarios", header: "Usuarios", cell: ({ row }) => <span className="text-center block">{row.original._count?.usuarios ?? 0}</span> },
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
        <h1 className="font-display text-xl font-bold text-slate-100">Regiones</h1>
        <Button icon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>Nueva Región</Button>
      </div>

      <DataTable data={rows} columns={columns} loading={loading} pageSize={10} pageSizeOptions={[10, 25]} getRowId={(row) => String(row.id)} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          {editing ? "Editar Región" : "Nueva Región"}
        </DialogHeader>
        <DialogBody>
          <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{editing ? "Actualizar" : "Crear"}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
