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
import { Checkbox } from "@/components/ui/Checkbox";
import { Divider } from "@/components/ui/Divider";
import { useToast } from "@/components/ui/Toast";

interface Etapa {
  id: number;
  nombre: string;
  orden: number;
  tipo: string;
  timer_dias: number | null;
  color: string;
  activo: boolean;
}

interface Transicion {
  id: number;
  nombre_accion: string;
  requiere_nota: boolean;
  requiere_supervisor: boolean;
  devuelve_al_pool: boolean;
  activo: boolean;
  etapa_origen: { id: number; nombre: string; color: string };
  etapa_destino: { id: number; nombre: string; color: string } | null;
}

const TIPO_COLORS: Record<string, "blue" | "yellow" | "green" | "slate"> = {
  AVANCE: "blue",
  SALIDA: "yellow",
  FINAL: "green",
};

export default function EmbudoPage() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [transiciones, setTransiciones] = useState<Transicion[]>([]);
  const [loadingE, setLoadingE] = useState(true);
  const [loadingT, setLoadingT] = useState(true);
  const { toast } = useToast();

  const [etapaDialogOpen, setEtapaDialogOpen] = useState(false);
  const [editingEtapa, setEditingEtapa] = useState<Etapa | null>(null);
  const [etapaForm, setEtapaForm] = useState({ nombre: "", orden: "", tipo: "AVANCE", timer_dias: "", color: "#1565c0" });

  const [transDialogOpen, setTransDialogOpen] = useState(false);
  const [transForm, setTransForm] = useState({
    etapa_origen_id: "", etapa_destino_id: "", nombre_accion: "",
    requiere_nota: true, requiere_supervisor: false, devuelve_al_pool: false,
  });

  const fetchEtapas = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/embudo/etapas");
      if (!res.ok) throw new Error("Error al cargar etapas");
      setEtapas(await res.json());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexión", "error");
    }
    setLoadingE(false);
  }, [toast]);

  const fetchTransiciones = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/embudo/transiciones");
      if (!res.ok) throw new Error("Error al cargar transiciones");
      setTransiciones(await res.json());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexión", "error");
    }
    setLoadingT(false);
  }, [toast]);

  useEffect(() => { fetchEtapas(); fetchTransiciones(); }, [fetchEtapas, fetchTransiciones]);

  const handleSaveEtapa = async () => {
    const url = editingEtapa ? `/api/admin/embudo/etapas/${editingEtapa.id}` : "/api/admin/embudo/etapas";
    const method = editingEtapa ? "PUT" : "POST";
    const body = {
      nombre: etapaForm.nombre, orden: Number(etapaForm.orden), tipo: etapaForm.tipo,
      timer_dias: etapaForm.timer_dias ? Number(etapaForm.timer_dias) : null, color: etapaForm.color,
    };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setEtapaDialogOpen(false);
      toast(editingEtapa ? "Etapa actualizada" : "Etapa creada", "success");
      fetchEtapas();
    } else {
      const data = await res.json();
      toast(data.error || "Error", "error");
    }
  };

  const handleToggleEtapa = async (etapa: Etapa) => {
    const res = await fetch(`/api/admin/embudo/etapas/${etapa.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !etapa.activo }),
    });
    if (res.ok) { toast(etapa.activo ? "Desactivada" : "Activada", "success"); fetchEtapas(); }
  };

  const handleSaveTransicion = async () => {
    const body = {
      etapa_origen_id: Number(transForm.etapa_origen_id),
      etapa_destino_id: transForm.devuelve_al_pool ? null : (transForm.etapa_destino_id ? Number(transForm.etapa_destino_id) : null),
      nombre_accion: transForm.nombre_accion,
      requiere_nota: transForm.requiere_nota,
      requiere_supervisor: transForm.requiere_supervisor,
      devuelve_al_pool: transForm.devuelve_al_pool,
    };
    const res = await fetch("/api/admin/embudo/transiciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setTransDialogOpen(false);
      setTransForm({ etapa_origen_id: "", etapa_destino_id: "", nombre_accion: "", requiere_nota: true, requiere_supervisor: false, devuelve_al_pool: false });
      toast("Transicion creada", "success");
      fetchTransiciones();
    } else {
      const data = await res.json();
      toast(data.error || "Error", "error");
    }
  };

  const handleToggleTransicion = async (t: Transicion) => {
    const res = await fetch(`/api/admin/embudo/transiciones/${t.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !t.activo }),
    });
    if (res.ok) { toast(t.activo ? "Desactivada" : "Activada", "success"); fetchTransiciones(); }
  };

  const etapaColumns: ColumnDef<Etapa, unknown>[] = [
    { accessorKey: "orden", header: "#", size: 60, cell: ({ getValue }) => <span className="text-center block text-slate-500">{getValue() as number}</span> },
    {
      accessorKey: "nombre", header: "Nombre",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.original.color }} />
          <span className="font-medium text-slate-100">{row.original.nombre}</span>
        </div>
      ),
    },
    {
      accessorKey: "tipo", header: "Tipo",
      cell: ({ getValue }) => <Badge color={TIPO_COLORS[getValue() as string] ?? "slate"}>{getValue() as string}</Badge>,
    },
    {
      accessorKey: "timer_dias", header: "Timer (dias)", size: 100,
      cell: ({ getValue }) => <span className="text-center block text-slate-400">{(getValue() as number | null) ?? "—"}</span>,
    },
    {
      accessorKey: "activo", header: "Estado", size: 90,
      cell: ({ getValue }) => <Badge color={getValue() ? "green" : "slate"}>{getValue() ? "Activo" : "Inactivo"}</Badge>,
    },
    {
      id: "actions", header: "Acciones", size: 110, enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => { setEditingEtapa(row.original); setEtapaForm({ nombre: row.original.nombre, orden: String(row.original.orden), tipo: row.original.tipo, timer_dias: row.original.timer_dias ? String(row.original.timer_dias) : "", color: row.original.color }); setEtapaDialogOpen(true); }} className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => handleToggleEtapa(row.original)} className={`p-1.5 rounded-lg transition-colors ${row.original.activo ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"}`}>
            {row.original.activo ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
      ),
    },
  ];

  const transColumns: ColumnDef<Transicion, unknown>[] = [
    {
      id: "etapa_origen", header: "Desde",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: row.original.etapa_origen?.color }}>
          {row.original.etapa_origen?.nombre ?? "—"}
        </span>
      ),
    },
    {
      id: "etapa_destino", header: "Hacia",
      cell: ({ row }) => row.original.devuelve_al_pool
        ? <Badge color="slate">Pool</Badge>
        : row.original.etapa_destino
          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: row.original.etapa_destino.color }}>{row.original.etapa_destino.nombre}</span>
          : <span className="text-slate-500">—</span>,
    },
    { accessorKey: "nombre_accion", header: "Acción", cell: ({ getValue }) => <span className="font-medium text-slate-100">{getValue() as string}</span> },
    { accessorKey: "requiere_nota", header: "Nota", size: 70, cell: ({ getValue }) => <span className="text-center block">{getValue() ? "✓" : "—"}</span> },
    { accessorKey: "requiere_supervisor", header: "Sup.", size: 70, cell: ({ getValue }) => <span className="text-center block">{getValue() ? "✓" : "—"}</span> },
    { accessorKey: "activo", header: "Estado", size: 90, cell: ({ getValue }) => <Badge color={getValue() ? "green" : "slate"}>{getValue() ? "Activo" : "Inactivo"}</Badge> },
    {
      id: "actions", header: "", size: 70, enableSorting: false,
      cell: ({ row }) => (
        <button onClick={() => handleToggleTransicion(row.original)} className={`p-1.5 rounded-lg transition-colors ${row.original.activo ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"}`}>
          {row.original.activo ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
        </button>
      ),
    },
  ];

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-slate-100 mb-6">Embudo de Ventas</h1>

      {/* ETAPAS */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-slate-100">Etapas</h2>
        <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setEditingEtapa(null); setEtapaForm({ nombre: "", orden: "", tipo: "AVANCE", timer_dias: "", color: "#1565c0" }); setEtapaDialogOpen(true); }}>
          Nueva Etapa
        </Button>
      </div>
      <DataTable data={etapas} columns={etapaColumns} loading={loadingE} pageSize={10} getRowId={(row) => String(row.id)} className="mb-6" />

      <Divider />

      {/* TRANSICIONES */}
      <div className="flex justify-between items-center mb-3 mt-3">
        <h2 className="text-lg font-semibold text-slate-100">Transiciones</h2>
        <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setTransDialogOpen(true)}>
          Nueva Transición
        </Button>
      </div>
      <DataTable data={transiciones} columns={transColumns} loading={loadingT} pageSize={25} pageSizeOptions={[25, 50]} getRowId={(row) => String(row.id)} />

      {/* Dialog Etapa */}
      <Dialog open={etapaDialogOpen} onClose={() => setEtapaDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setEtapaDialogOpen(false)}>
          {editingEtapa ? "Editar Etapa" : "Nueva Etapa"}
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Input label="Nombre" value={etapaForm.nombre} onChange={(e) => setEtapaForm({ ...etapaForm, nombre: e.target.value })} required />
          <Input label="Orden" type="number" value={etapaForm.orden} onChange={(e) => setEtapaForm({ ...etapaForm, orden: e.target.value })} required />
          <Select label="Tipo" value={etapaForm.tipo} onChange={(e) => setEtapaForm({ ...etapaForm, tipo: e.target.value })} options={[{ value: "AVANCE", label: "AVANCE" }, { value: "SALIDA", label: "SALIDA" }, { value: "FINAL", label: "FINAL" }]} />
          <Input label="Timer (dias, opcional)" type="number" value={etapaForm.timer_dias} onChange={(e) => setEtapaForm({ ...etapaForm, timer_dias: e.target.value })} />
          <div className="flex items-center gap-3">
            <Input label="Color (hex)" value={etapaForm.color} onChange={(e) => setEtapaForm({ ...etapaForm, color: e.target.value })} />
            <div className="w-9 h-9 rounded-lg border border-slate-700 shrink-0 mt-6" style={{ backgroundColor: etapaForm.color }} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEtapaDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveEtapa}>{editingEtapa ? "Actualizar" : "Crear"}</Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog Transicion */}
      <Dialog open={transDialogOpen} onClose={() => setTransDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setTransDialogOpen(false)}>Nueva Transición</DialogHeader>
        <DialogBody className="space-y-4">
          <Select
            label="Desde etapa"
            value={transForm.etapa_origen_id}
            onChange={(e) => setTransForm({ ...transForm, etapa_origen_id: e.target.value })}
            options={etapas.filter(e => e.activo).map((e) => ({ value: String(e.id), label: e.nombre }))}
            placeholder="Seleccionar..."
          />
          <Checkbox
            label="Devuelve al pool"
            checked={transForm.devuelve_al_pool}
            onChange={(e) => setTransForm({ ...transForm, devuelve_al_pool: (e.target as HTMLInputElement).checked, etapa_destino_id: "" })}
          />
          {!transForm.devuelve_al_pool && (
            <Select
              label="Hacia etapa"
              value={transForm.etapa_destino_id}
              onChange={(e) => setTransForm({ ...transForm, etapa_destino_id: e.target.value })}
              options={etapas.filter(e => e.activo).map((e) => ({ value: String(e.id), label: e.nombre }))}
              placeholder="Seleccionar..."
            />
          )}
          <Input label="Nombre de acción" value={transForm.nombre_accion} onChange={(e) => setTransForm({ ...transForm, nombre_accion: e.target.value })} required />
          <Checkbox label="Requiere nota" checked={transForm.requiere_nota} onChange={(e) => setTransForm({ ...transForm, requiere_nota: (e.target as HTMLInputElement).checked })} />
          <Checkbox label="Requiere supervisor" checked={transForm.requiere_supervisor} onChange={(e) => setTransForm({ ...transForm, requiere_supervisor: (e.target as HTMLInputElement).checked })} />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setTransDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveTransicion} disabled={!transForm.etapa_origen_id || !transForm.nombre_accion}>Crear</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
