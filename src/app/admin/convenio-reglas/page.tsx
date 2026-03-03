"use client";
import { useEffect, useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2 } from "lucide-react";

const CAMPOS_PREDEFINIDOS = [
  { value: "nss", label: "NSS" },
  { value: "curp", label: "CURP" },
  { value: "rfc", label: "RFC" },
  { value: "num_empleado", label: "Numero de empleado" },
  { value: "tel_2", label: "Telefono 2" },
  { value: "estado", label: "Estado" },
  { value: "municipio", label: "Municipio" },
  { value: "direccion_email", label: "Email" },
  { value: "a_paterno", label: "Apellido paterno" },
  { value: "a_materno", label: "Apellido materno" },
];

interface Regla {
  id: number;
  convenio: string;
  campo: string;
  obligatorio: boolean;
}

interface Convenio {
  id: number;
  nombre: string;
}

export default function ConvenioReglasPage() {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [filtroConvenio, setFiltroConvenio] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nuevo, setNuevo] = useState({ campo: "", obligatorio: true });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const cargarReglas = async () => {
    try {
      const res = await fetch("/api/admin/convenio-reglas");
      if (!res.ok) throw new Error("Error al cargar reglas");
      setReglas(await res.json());
    } catch {
      toast("Error al cargar reglas", "error");
    }
  };

  const cargarConvenios = async () => {
    try {
      const res = await fetch("/api/captaciones/convenios");
      if (!res.ok) throw new Error("Error al cargar convenios");
      setConvenios(await res.json());
    } catch {
      toast("Error al cargar convenios", "error");
    }
  };

  useEffect(() => {
    cargarReglas();
    cargarConvenios();
  }, []);

  const reglasFiltradas = filtroConvenio
    ? reglas.filter((r) => r.convenio === filtroConvenio)
    : reglas;

  const handleToggleObligatorio = async (regla: Regla) => {
    await fetch(`/api/admin/convenio-reglas/${regla.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obligatorio: !regla.obligatorio }),
    });
    cargarReglas();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar esta regla?")) return;
    await fetch(`/api/admin/convenio-reglas/${id}`, { method: "DELETE" });
    cargarReglas();
  };

  const handleSave = async () => {
    if (!filtroConvenio) {
      toast("Selecciona un convenio primero", "error");
      return;
    }
    if (!nuevo.campo) {
      toast("Selecciona un campo", "error");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/convenio-reglas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ convenio: filtroConvenio, campo: nuevo.campo, obligatorio: nuevo.obligatorio }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      toast(data.error ?? "Error al guardar", "error");
      return;
    }
    setDialogOpen(false);
    setNuevo({ campo: "", obligatorio: true });
    cargarReglas();
  };

  const columns: ColumnDef<Regla, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "convenio",
        header: "Convenio",
        minSize: 180,
      },
      {
        accessorKey: "campo",
        header: "Campo",
        minSize: 150,
        cell: ({ getValue }) => {
          const value = getValue() as string;
          const label = CAMPOS_PREDEFINIDOS.find((c) => c.value === value)?.label ?? value;
          return <Badge color="slate">{label}</Badge>;
        },
      },
      {
        accessorKey: "obligatorio",
        header: "Obligatorio",
        size: 130,
        cell: ({ row }) => (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <div className="relative inline-flex">
              <input
                type="checkbox"
                checked={row.original.obligatorio}
                onChange={() => handleToggleObligatorio(row.original)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-700 peer-checked:bg-amber-500 rounded-full transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
            </div>
          </label>
        ),
      },
      {
        id: "acciones",
        header: "",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={() => handleDelete(row.original.id)}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ),
      },
    ],
    [reglas]
  );

  const convenioOptions = convenios.map((c) => ({ value: c.nombre, label: c.nombre }));
  const campoOptions = CAMPOS_PREDEFINIDOS.map((c) => ({ value: c.value, label: c.label }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl font-bold text-slate-100">Reglas por Convenio</h1>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setDialogOpen(true)}
          disabled={!filtroConvenio}
        >
          Agregar campo
        </Button>
      </div>

      <div className="mb-4 max-w-sm">
        <Select
          label="Filtrar por convenio"
          value={filtroConvenio}
          onChange={(e) => setFiltroConvenio(e.target.value)}
          options={convenioOptions}
          placeholder="Todos los convenios"
        />
      </div>

      <DataTable
        data={reglasFiltradas}
        columns={columns}
        pageSize={25}
        pageSizeOptions={[25, 50]}
        emptyMessage="No hay reglas configuradas"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          Agregar campo al convenio
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <p className="text-sm text-slate-400">
            Convenio: <strong className="text-slate-200">{filtroConvenio}</strong>
          </p>
          <Select
            label="Campo"
            value={nuevo.campo}
            onChange={(e) => setNuevo((p) => ({ ...p, campo: e.target.value }))}
            options={campoOptions}
            placeholder="Seleccionar campo..."
          />
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <div className="relative inline-flex">
              <input
                type="checkbox"
                checked={nuevo.obligatorio}
                onChange={(e) => setNuevo((p) => ({ ...p, obligatorio: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-700 peer-checked:bg-amber-500 rounded-full transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
            </div>
            <span className="text-sm text-slate-300">Obligatorio</span>
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="danger" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>Guardar</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
