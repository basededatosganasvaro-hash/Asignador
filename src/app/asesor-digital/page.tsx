"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Search, TrendingUp, Users, ShoppingCart, XCircle, Download } from "lucide-react";

interface Registro {
  id: number;
  etapa: string;
  nombre_cliente: string;
  fecha: string;
  status: string;
  estrategia: string | null;
  flujo: string | null;
  numero_telefono: string | null;
  curp: string | null;
  nss: string | null;
  rfc: string | null;
  zona: string | null;
  campana: string | null;
  capacidad: string | null;
  monto_credito: number | null;
  tipo_credito: string | null;
  convenio: string | null;
  etiqueta: string | null;
  oferta: string | null;
  motivo: string | null;
  id_venta: string | null;
  viabilidad: string | null;
  created_at: string;
}

const ETAPAS = ["Leads", "Cotizacion", "No sujeto a credito", "Ventas"] as const;

const ETAPA_CONFIG: Record<string, { color: "blue" | "amber" | "red" | "green"; icon: typeof TrendingUp }> = {
  Leads: { color: "blue", icon: Users },
  Cotizacion: { color: "amber", icon: TrendingUp },
  "No sujeto a credito": { color: "red", icon: XCircle },
  Ventas: { color: "green", icon: ShoppingCart },
};

const STATUS_OPTIONS = ["Venta", "Interesado", "Cotizacion", "No viable", "Proceso", "Sin informacion"];
const ESTRATEGIA_OPTIONS = ["facebook", "VoxImplant", "Wasapi", "WasapiCNCA", "WasapiNuevo", "Consunomina", "Organico"];
const FLUJO_OPTIONS = ["1 contacto", "2 contactos", "3 contactos"];
const CAMPANA_OPTIONS = ["IMSS Pensionados", "SNTE23", "SEIEM", "CDMX", "SNTE17y36", "GEM", "IMSS", "Nuevo Leon", "SNTE14"];
const TIPO_CREDITO_OPTIONS = ["Nuevo", "Refinanciamiento", "LCOM", "CNCA"];
const CONVENIO_OPTIONS = ["IMSS Pensionados", "GEM", "CDMX", "IMSS Jubilados", "INE", "SEIEM", "SEP", "SNTE23", "Gob Chihuahua", "Gob Nuevo Leon", "SNTE14", "SEDUC", "SNTE21"];
const ETIQUETA_OPTIONS = ["Llamada", "Whatsapp"];
const OFERTA_OPTIONS = ["Si", "No"];

const STATUS_COLORS: Record<string, "green" | "blue" | "amber" | "red" | "purple" | "slate"> = {
  Venta: "green",
  Interesado: "blue",
  Cotizacion: "amber",
  "No viable": "red",
  Proceso: "purple",
  "Sin informacion": "slate",
};

const EMPTY_FORM = {
  etapa: "Leads",
  nombre_cliente: "",
  fecha: new Date().toISOString().split("T")[0],
  status: "Sin informacion",
  estrategia: "",
  flujo: "",
  numero_telefono: "",
  curp: "",
  nss: "",
  rfc: "",
  zona: "",
  campana: "",
  capacidad: "",
  monto_credito: "",
  tipo_credito: "",
  convenio: "",
  etiqueta: "",
  oferta: "",
  motivo: "",
  id_venta: "",
  viabilidad: "",
};

export default function AsesorDigitalPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Registro | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const { toast } = useToast();

  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchRegistros = useCallback(async () => {
    try {
      const res = await fetch("/api/asesor-digital/registros");
      if (!res.ok) throw new Error("Error al cargar registros");
      const data = await res.json();
      setRegistros(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  const conteos = useMemo(() => {
    const c: Record<string, number> = {};
    ETAPAS.forEach((e) => (c[e] = 0));
    registros.forEach((r) => {
      if (c[r.etapa] !== undefined) c[r.etapa]++;
    });
    return c;
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtroEtapa && r.etapa !== filtroEtapa) return false;
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (busqueda.trim()) {
        const term = busqueda.toLowerCase();
        if (
          !r.nombre_cliente.toLowerCase().includes(term) &&
          !(r.numero_telefono && r.numero_telefono.includes(term)) &&
          !(r.nss && r.nss.includes(term)) &&
          !(r.curp && r.curp.toLowerCase().includes(term))
        )
          return false;
      }
      return true;
    });
  }, [registros, busqueda, filtroEtapa, filtroStatus]);

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setFormData({ ...EMPTY_FORM, fecha: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };

  const handleOpenEdit = (record: Registro) => {
    setEditingRecord(record);
    setFormData({
      etapa: record.etapa,
      nombre_cliente: record.nombre_cliente,
      fecha: record.fecha ? record.fecha.split("T")[0] : "",
      status: record.status,
      estrategia: record.estrategia || "",
      flujo: record.flujo || "",
      numero_telefono: record.numero_telefono || "",
      curp: record.curp || "",
      nss: record.nss || "",
      rfc: record.rfc || "",
      zona: record.zona || "",
      campana: record.campana || "",
      capacidad: record.capacidad || "",
      monto_credito: record.monto_credito ? String(record.monto_credito) : "",
      tipo_credito: record.tipo_credito || "",
      convenio: record.convenio || "",
      etiqueta: record.etiqueta || "",
      oferta: record.oferta || "",
      motivo: record.motivo || "",
      id_venta: record.id_venta || "",
      viabilidad: record.viabilidad || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nombre_cliente.trim()) {
      toast("El nombre del cliente es obligatorio", "error");
      return;
    }

    const url = editingRecord
      ? `/api/asesor-digital/registros/${editingRecord.id}`
      : "/api/asesor-digital/registros";
    const method = editingRecord ? "PUT" : "POST";

    const body = {
      ...formData,
      monto_credito: formData.monto_credito ? Number(formData.monto_credito) : null,
      estrategia: formData.estrategia || null,
      flujo: formData.flujo || null,
      numero_telefono: formData.numero_telefono || null,
      curp: formData.curp || null,
      nss: formData.nss || null,
      rfc: formData.rfc || null,
      zona: formData.zona || null,
      campana: formData.campana || null,
      capacidad: formData.capacidad || null,
      tipo_credito: formData.tipo_credito || null,
      convenio: formData.convenio || null,
      etiqueta: formData.etiqueta || null,
      oferta: formData.oferta || null,
      motivo: formData.motivo || null,
      id_venta: formData.id_venta || null,
      viabilidad: formData.viabilidad || null,
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setDialogOpen(false);
      toast(editingRecord ? "Registro actualizado" : "Registro creado", "success");
      fetchRegistros();
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/asesor-digital/registros/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Registro eliminado", "success");
      setDeleteConfirmId(null);
      fetchRegistros();
    } else {
      toast("Error al eliminar", "error");
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const columns: ColumnDef<Registro, unknown>[] = [
    {
      accessorKey: "nombre_cliente",
      header: "Cliente",
      size: 180,
    },
    {
      accessorKey: "etapa",
      header: "Etapa",
      size: 150,
      cell: ({ row }) => {
        const cfg = ETAPA_CONFIG[row.original.etapa];
        return <Badge color={cfg?.color ?? "slate"}>{row.original.etapa}</Badge>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 130,
      cell: ({ row }) => (
        <Badge color={STATUS_COLORS[row.original.status] ?? "slate"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "numero_telefono",
      header: "Telefono",
      size: 130,
      cell: ({ row }) => (
        <span className="text-sm text-slate-400">
          {row.original.numero_telefono || "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "estrategia",
      header: "Estrategia",
      size: 120,
      cell: ({ row }) => (
        <span className="text-sm text-slate-400">
          {row.original.estrategia || "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "campana",
      header: "Campaña",
      size: 140,
      cell: ({ row }) => (
        <span className="text-sm text-slate-400">
          {row.original.campana || "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "convenio",
      header: "Convenio",
      size: 140,
      cell: ({ row }) => (
        <span className="text-sm text-slate-400">
          {row.original.convenio || "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "fecha",
      header: "Fecha",
      size: 110,
      cell: ({ row }) => {
        const f = row.original.fecha;
        return (
          <span className="text-sm text-slate-400">
            {f ? new Date(f).toLocaleDateString("es-MX") : "\u2014"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Acciones",
      size: 100,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenEdit(row.original)}
            title="Editar"
            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirmId(row.original.id)}
            title="Eliminar"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-xl font-bold text-slate-100">Mis Registros</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
            onClick={() => window.open("/api/asesor-digital/registros/exportar", "_blank")}
          >
            Descargar
          </Button>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>
            Nuevo Registro
          </Button>
        </div>
      </div>

      {/* Pipeline cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {ETAPAS.map((etapa) => {
          const cfg = ETAPA_CONFIG[etapa];
          const Icon = cfg.icon;
          return (
            <StatCard
              key={etapa}
              title={etapa}
              value={conteos[etapa] ?? 0}
              icon={<Icon className="w-5 h-5" />}
              color={cfg.color}
            />
          );
        })}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Input
            placeholder="Buscar por nombre, telefono, NSS, CURP..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            label="Etapa"
            value={filtroEtapa}
            onChange={(e) => setFiltroEtapa(e.target.value)}
            placeholder="Todas las etapas"
            options={ETAPAS.map((e) => ({ value: e, label: e }))}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            label="Status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            placeholder="Todos los status"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
        </div>
        {(filtroEtapa || filtroStatus) && (
          <button
            onClick={() => { setFiltroEtapa(""); setFiltroStatus(""); }}
            className="text-xs text-slate-400 hover:text-amber-400 transition-colors pb-2"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <DataTable
        data={registrosFiltrados}
        columns={columns}
        loading={loading}
        pageSize={15}
        pageSizeOptions={[15, 30, 50]}
      />

      {/* Dialog confirmar eliminacion */}
      <Dialog open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} maxWidth="sm">
        <DialogHeader onClose={() => setDeleteConfirmId(null)}>Confirmar Eliminacion</DialogHeader>
        <DialogBody>
          <p className="text-slate-300">¿Estas seguro de que deseas eliminar este registro? Esta accion no se puede deshacer.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Eliminar</Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          {editingRecord ? "Editar Registro" : "Nuevo Registro"}
        </DialogHeader>
        <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre del Cliente *"
              value={formData.nombre_cliente}
              onChange={(e) => updateField("nombre_cliente", e.target.value)}
              required
            />
            <Input
              label="Fecha"
              type="date"
              value={formData.fecha}
              onChange={(e) => updateField("fecha", e.target.value)}
            />
            <Select
              label="Etapa"
              value={formData.etapa}
              onChange={(e) => updateField("etapa", e.target.value)}
              options={ETAPAS.map((e) => ({ value: e, label: e }))}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => updateField("status", e.target.value)}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Estrategia"
              value={formData.estrategia}
              onChange={(e) => updateField("estrategia", e.target.value)}
              placeholder="Seleccionar..."
              options={ESTRATEGIA_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Flujo"
              value={formData.flujo}
              onChange={(e) => updateField("flujo", e.target.value)}
              placeholder="Seleccionar..."
              options={FLUJO_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
            <Input
              label="Numero Telefono"
              value={formData.numero_telefono}
              onChange={(e) => updateField("numero_telefono", e.target.value)}
            />
            <Input
              label="CURP"
              value={formData.curp}
              onChange={(e) => updateField("curp", e.target.value)}
              maxLength={18}
            />
            <Input
              label="NSS"
              value={formData.nss}
              onChange={(e) => updateField("nss", e.target.value)}
              maxLength={15}
            />
            <Input
              label="RFC"
              value={formData.rfc}
              onChange={(e) => updateField("rfc", e.target.value)}
              maxLength={13}
            />
            <Input
              label="Zona"
              value={formData.zona}
              onChange={(e) => updateField("zona", e.target.value)}
            />
            <Select
              label="Campaña"
              value={formData.campana}
              onChange={(e) => updateField("campana", e.target.value)}
              placeholder="Seleccionar..."
              options={CAMPANA_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
            <Input
              label="Capacidad"
              value={formData.capacidad}
              onChange={(e) => updateField("capacidad", e.target.value)}
            />
            <Input
              label="Monto de Credito"
              type="number"
              value={formData.monto_credito}
              onChange={(e) => updateField("monto_credito", e.target.value)}
            />
            <Select
              label="Tipo de Credito"
              value={formData.tipo_credito}
              onChange={(e) => updateField("tipo_credito", e.target.value)}
              placeholder="Seleccionar..."
              options={TIPO_CREDITO_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Convenio"
              value={formData.convenio}
              onChange={(e) => updateField("convenio", e.target.value)}
              placeholder="Seleccionar..."
              options={CONVENIO_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Etiqueta"
              value={formData.etiqueta}
              onChange={(e) => updateField("etiqueta", e.target.value)}
              placeholder="Seleccionar..."
              options={ETIQUETA_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Oferta"
              value={formData.oferta}
              onChange={(e) => updateField("oferta", e.target.value)}
              placeholder="Seleccionar..."
              options={OFERTA_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
            <Input
              label="ID Venta"
              value={formData.id_venta}
              onChange={(e) => updateField("id_venta", e.target.value)}
            />
            <Input
              label="Viabilidad"
              value={formData.viabilidad}
              onChange={(e) => updateField("viabilidad", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Motivo</label>
            <textarea
              className="w-full rounded-lg bg-slate-900/50 border border-slate-700/60 text-slate-200 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-colors
                placeholder:text-slate-600 min-h-[80px]"
              value={formData.motivo}
              onChange={(e) => updateField("motivo", e.target.value)}
              placeholder="Motivo o notas adicionales..."
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>
            {editingRecord ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
