"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeColor } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, Pencil, Trash2, Search, Download, Save, Filter,
  ShoppingCart, UserCheck, FileText, XCircle, Clock, HelpCircle,
} from "lucide-react";

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

const STATUS_OPTIONS = ["Venta", "Interesado", "Cotizacion", "No viable", "Proceso", "Sin informacion"];
const ETAPA_OPTIONS = ["Leads", "Cotizacion", "No sujeto a credito", "Ventas"];
const ESTRATEGIA_OPTIONS = ["facebook", "VoxImplant", "Wasapi", "WasapiCNCA", "WasapiNuevo", "Consunomina", "Organico"];
const FLUJO_OPTIONS = ["1 contacto", "2 contactos", "3 contactos"];
const CAMPANA_OPTIONS = ["IMSS Pensionados", "SNTE23", "SEIEM", "CDMX", "SNTE17y36", "GEM", "IMSS", "Nuevo Leon", "SNTE14"];
const TIPO_CREDITO_OPTIONS = ["Nuevo", "Refinanciamiento", "LCOM", "CNCA"];
const CONVENIO_OPTIONS = ["IMSS Pensionados", "GEM", "CDMX", "IMSS Jubilados", "INE", "SEIEM", "SEP", "SNTE23", "Gob Chihuahua", "Gob Nuevo Leon", "SNTE14", "SEDUC", "SNTE21"];
const ETIQUETA_OPTIONS = ["Llamada", "Whatsapp"];
const OFERTA_OPTIONS = ["Si", "No"];

const STATUS_COLORS: Record<string, BadgeColor> = {
  Venta: "green",
  Interesado: "blue",
  Cotizacion: "amber",
  "No viable": "red",
  Proceso: "purple",
  "Sin informacion": "slate",
};

const ESTRATEGIA_COLORS: Record<string, BadgeColor> = {
  facebook: "blue",
  VoxImplant: "purple",
  Wasapi: "emerald",
  WasapiCNCA: "teal",
  WasapiNuevo: "green",
  Consunomina: "red",
  Organico: "orange",
};

// Case-insensitive color lookup — matches DB values regardless of casing/spacing
function getColor(map: Record<string, BadgeColor>, value: string | null | undefined): BadgeColor {
  if (!value) return "slate";
  if (map[value]) return map[value];
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  for (const [key, color] of Object.entries(map)) {
    if (key.toLowerCase().replace(/\s+/g, "") === normalized) return color;
  }
  return "slate";
}

const CAMPANA_COLORS: Record<string, BadgeColor> = {
  "IMSS Pensionados": "blue",
  SNTE23: "purple",
  SEIEM: "teal",
  CDMX: "orange",
  "SNTE17y36": "amber",
  GEM: "green",
  IMSS: "emerald",
  "Nuevo Leon": "red",
  SNTE14: "yellow",
};

const ETAPA_COLORS: Record<string, BadgeColor> = {
  Leads: "blue",
  Cotizacion: "amber",
  "No sujeto a credito": "red",
  Ventas: "green",
};

const CONVENIO_COLORS: Record<string, BadgeColor> = {
  "IMSS Pensionados": "blue",
  GEM: "green",
  CDMX: "orange",
  "IMSS Jubilados": "teal",
  INE: "purple",
  SEIEM: "emerald",
  SEP: "amber",
  SNTE23: "purple",
  "Gob Chihuahua": "red",
  "Gob Nuevo Leon": "red",
  SNTE14: "yellow",
  SEDUC: "teal",
  SNTE21: "orange",
};

const STATUS_PIPELINE: { key: string; label: string; color: string; gradient: string; icon: typeof ShoppingCart }[] = [
  { key: "Venta", label: "Venta", color: "text-green-400", gradient: "from-green-500 to-green-600", icon: ShoppingCart },
  { key: "Interesado", label: "Interesado", color: "text-blue-400", gradient: "from-blue-500 to-blue-600", icon: UserCheck },
  { key: "Cotizacion", label: "Cotizacion", color: "text-amber-400", gradient: "from-amber-500 to-amber-600", icon: FileText },
  { key: "No viable", label: "No viable", color: "text-red-400", gradient: "from-red-500 to-red-600", icon: XCircle },
  { key: "Proceso", label: "Proceso", color: "text-purple-400", gradient: "from-purple-500 to-purple-600", icon: Clock },
  { key: "Sin informacion", label: "Sin info", color: "text-slate-400", gradient: "from-slate-500 to-slate-600", icon: HelpCircle },
];

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

// ─── Column filter dropdown (Excel-style) ───────────────────────────
function ColumnFilterDropdown({
  label,
  options,
  value,
  onChange,
  colorMap,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  colorMap?: Record<string, BadgeColor>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(!open);
  };

  const isFiltered = value !== "";
  const hasOptions = options.length > 0;

  return (
    <div className="inline-flex items-center">
      <span className="mr-1">{label}</span>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className={`p-0.5 rounded transition-colors ${
          isFiltered ? "text-amber-400" : "text-slate-600 hover:text-slate-400"
        }`}
      >
        <Filter className="w-3 h-3" />
      </button>
      {open && hasOptions && (
        <div
          ref={ref}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-[100] min-w-[200px] max-h-64 overflow-y-auto
            bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
              value === "" ? "bg-amber-500/15 text-amber-400" : "text-slate-400 hover:bg-slate-700"
            }`}
          >
            Todos
          </button>
          <div className="h-px bg-slate-700/50 my-0.5" />
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(value === opt ? "" : opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                value === opt ? "bg-amber-500/15 text-amber-400" : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              {colorMap ? (
                <Badge color={getColor(colorMap, opt)}>{opt}</Badge>
              ) : (
                opt
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function AsesorDigitalPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Registro | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [viewRecord, setViewRecord] = useState<Registro | null>(null);
  const [viewForm, setViewForm] = useState<Record<string, string>>({});
  const [viewDirty, setViewDirty] = useState(false);
  const [viewSaving, setViewSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const { toast } = useToast();

  // Column filters — default Status = Interesado
  const [filtroStatus, setFiltroStatus] = useState("Interesado");
  const [filtroEstrategia, setFiltroEstrategia] = useState("");
  const [filtroCampana, setFiltroCampana] = useState("");
  const [filtroConvenio, setFiltroConvenio] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");

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

  // Inline status change
  const handleInlineStatusChange = async (registro: Registro, newStatus: string) => {
    const res = await fetch(`/api/asesor-digital/registros/${registro.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setRegistros((prev) =>
        prev.map((r) => (r.id === registro.id ? { ...r, status: newStatus } : r))
      );
    } else {
      toast("Error al cambiar status", "error");
    }
  };

  // Conteos por status (sin filtros)
  const conteos = useMemo(() => {
    const c: Record<string, number> = {};
    STATUS_PIPELINE.forEach((s) => (c[s.key] = 0));
    registros.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroEstrategia && r.estrategia !== filtroEstrategia) return false;
      if (filtroCampana && r.campana !== filtroCampana) return false;
      if (filtroConvenio && r.convenio !== filtroConvenio) return false;
      if (filtroEtapa && r.etapa !== filtroEtapa) return false;
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
  }, [registros, busqueda, filtroStatus, filtroEstrategia, filtroCampana, filtroConvenio, filtroEtapa]);

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

  const openViewRecord = (record: Registro) => {
    setViewRecord(record);
    setViewForm({
      nombre_cliente: record.nombre_cliente,
      fecha: record.fecha ? record.fecha.split("T")[0] : "",
      status: record.status,
      etapa: record.etapa,
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
    setViewDirty(false);
  };

  const updateViewField = (field: string, value: string) => {
    setViewForm((prev) => ({ ...prev, [field]: value }));
    setViewDirty(true);
  };

  const handleViewSave = async () => {
    if (!viewRecord) return;
    setViewSaving(true);

    const body = {
      ...viewForm,
      monto_credito: viewForm.monto_credito ? Number(viewForm.monto_credito) : null,
      estrategia: viewForm.estrategia || null,
      flujo: viewForm.flujo || null,
      numero_telefono: viewForm.numero_telefono || null,
      curp: viewForm.curp || null,
      nss: viewForm.nss || null,
      rfc: viewForm.rfc || null,
      zona: viewForm.zona || null,
      campana: viewForm.campana || null,
      capacidad: viewForm.capacidad || null,
      tipo_credito: viewForm.tipo_credito || null,
      convenio: viewForm.convenio || null,
      etiqueta: viewForm.etiqueta || null,
      oferta: viewForm.oferta || null,
      motivo: viewForm.motivo || null,
      id_venta: viewForm.id_venta || null,
      viabilidad: viewForm.viabilidad || null,
    };

    const res = await fetch(`/api/asesor-digital/registros/${viewRecord.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setViewSaving(false);
    if (res.ok) {
      toast("Registro actualizado", "success");
      setViewDirty(false);
      setViewRecord(null);
      fetchRegistros();
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  // Unique values for column filter dropdowns (from all data, not filtered)
  const uniqueEstrategias = useMemo(() => [...new Set(registros.map((r) => r.estrategia).filter(Boolean) as string[])].sort(), [registros]);
  const uniqueCampanas = useMemo(() => [...new Set(registros.map((r) => r.campana).filter(Boolean) as string[])].sort(), [registros]);
  const uniqueConvenios = useMemo(() => [...new Set(registros.map((r) => r.convenio).filter(Boolean) as string[])].sort(), [registros]);
  const uniqueEtapas = useMemo(() => [...new Set(registros.map((r) => r.etapa).filter(Boolean) as string[])].sort(), [registros]);

  // Active filters count
  const activeFilters = [filtroStatus, filtroEstrategia, filtroCampana, filtroConvenio, filtroEtapa].filter(Boolean).length;

  const columns: ColumnDef<Registro, unknown>[] = [
    {
      accessorKey: "nombre_cliente",
      header: "Cliente",
      size: 180,
      cell: ({ row }) => (
        <button
          onClick={() => openViewRecord(row.original)}
          className="text-sm text-slate-200 hover:text-amber-400 transition-colors text-left underline decoration-slate-700 hover:decoration-amber-400"
        >
          {row.original.nombre_cliente}
        </button>
      ),
    },
    {
      accessorKey: "status",
      header: () => (
        <ColumnFilterDropdown
          label="Status"
          options={STATUS_OPTIONS}
          value={filtroStatus}
          onChange={setFiltroStatus}
          colorMap={STATUS_COLORS}
        />
      ),
      size: 170,
      enableSorting: false,
      cell: ({ row }) => (
        <select
          value={row.original.status}
          onChange={(e) => handleInlineStatusChange(row.original, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={`
            text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer outline-none transition-colors
            ${getColor(STATUS_COLORS, row.original.status) === "green" ? "bg-green-500/15 text-green-400 ring-1 ring-green-500/30" : ""}
            ${getColor(STATUS_COLORS, row.original.status) === "blue" ? "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30" : ""}
            ${getColor(STATUS_COLORS, row.original.status) === "amber" ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30" : ""}
            ${getColor(STATUS_COLORS, row.original.status) === "red" ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30" : ""}
            ${getColor(STATUS_COLORS, row.original.status) === "purple" ? "bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30" : ""}
            ${getColor(STATUS_COLORS, row.original.status) === "slate" ? "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30" : ""}
          `}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="bg-slate-800 text-slate-200">{s}</option>
          ))}
        </select>
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
      header: () => (
        <ColumnFilterDropdown
          label="Estrategia"
          options={uniqueEstrategias}
          value={filtroEstrategia}
          onChange={setFiltroEstrategia}
          colorMap={ESTRATEGIA_COLORS}
        />
      ),
      size: 140,
      enableSorting: false,
      cell: ({ row }) => row.original.estrategia
        ? <Badge color={getColor(ESTRATEGIA_COLORS, row.original.estrategia)}>{row.original.estrategia}</Badge>
        : <span className="text-sm text-slate-600">&mdash;</span>,
    },
    {
      accessorKey: "campana",
      header: () => (
        <ColumnFilterDropdown
          label="Campaña"
          options={uniqueCampanas}
          value={filtroCampana}
          onChange={setFiltroCampana}
          colorMap={CAMPANA_COLORS}
        />
      ),
      size: 160,
      enableSorting: false,
      cell: ({ row }) => row.original.campana
        ? <Badge color={getColor(CAMPANA_COLORS, row.original.campana)}>{row.original.campana}</Badge>
        : <span className="text-sm text-slate-600">&mdash;</span>,
    },
    {
      accessorKey: "convenio",
      header: () => (
        <ColumnFilterDropdown
          label="Convenio"
          options={uniqueConvenios}
          value={filtroConvenio}
          onChange={setFiltroConvenio}
          colorMap={CONVENIO_COLORS}
        />
      ),
      size: 160,
      enableSorting: false,
      cell: ({ row }) => row.original.convenio
        ? <Badge color={getColor(CONVENIO_COLORS, row.original.convenio)}>{row.original.convenio}</Badge>
        : <span className="text-sm text-slate-600">&mdash;</span>,
    },
    {
      accessorKey: "etapa",
      header: () => (
        <ColumnFilterDropdown
          label="Etapa"
          options={uniqueEtapas}
          value={filtroEtapa}
          onChange={setFiltroEtapa}
          colorMap={ETAPA_COLORS}
        />
      ),
      size: 160,
      enableSorting: false,
      cell: ({ row }) => row.original.etapa
        ? <Badge color={getColor(ETAPA_COLORS, row.original.etapa)}>{row.original.etapa}</Badge>
        : <span className="text-sm text-slate-600">&mdash;</span>,
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

      {/* Pipeline cards por Status — clicables */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {STATUS_PIPELINE.map((s) => {
          const Icon = s.icon;
          const isActive = filtroStatus === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFiltroStatus(isActive ? "" : s.key)}
              className={`
                bg-surface rounded-xl border p-4 relative overflow-hidden text-left transition-all
                ${isActive
                  ? "border-amber-500/60 ring-1 ring-amber-500/30"
                  : "border-slate-800/60 hover:border-slate-700"
                }
              `}
            >
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${s.gradient}`} />
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${s.color}`} />
                <span className="font-display text-2xl font-extrabold text-slate-100">
                  {conteos[s.key] ?? 0}
                </span>
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de busqueda + info filtros activos */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Buscar por nombre, telefono, NSS, CURP..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        {activeFilters > 0 && (
          <div className="flex items-center gap-2 pb-1">
            <span className="text-xs text-slate-500">
              {activeFilters} filtro{activeFilters > 1 ? "s" : ""} activo{activeFilters > 1 ? "s" : ""}
            </span>
            <button
              onClick={() => { setFiltroStatus(""); setFiltroEstrategia(""); setFiltroCampana(""); setFiltroConvenio(""); setFiltroEtapa(""); }}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Limpiar todos
            </button>
          </div>
        )}
      </div>

      <DataTable
        data={registrosFiltrados}
        columns={columns}
        loading={loading}
        pageSize={15}
        pageSizeOptions={[15, 30, 50]}
      />

      {/* Dialog detalle/edicion del cliente */}
      <Dialog open={viewRecord !== null} onClose={() => setViewRecord(null)} maxWidth="2xl">
        <DialogHeader onClose={() => setViewRecord(null)}>
          <div className="flex items-center gap-3 flex-wrap">
            <span>{viewForm.nombre_cliente || viewRecord?.nombre_cliente}</span>
            {viewForm.status && (
              <Badge color={getColor(STATUS_COLORS, viewForm.status)}>{viewForm.status}</Badge>
            )}
            {viewForm.etapa && (
              <Badge color={getColor(ETAPA_COLORS, viewForm.etapa)}>{viewForm.etapa}</Badge>
            )}
          </div>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto space-y-6">
          {viewRecord && (
            <>
              {/* Seccion: Datos principales */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Datos del Cliente</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Input label="Nombre del Cliente" value={viewForm.nombre_cliente} onChange={(e) => updateViewField("nombre_cliente", e.target.value)} />
                  <Input label="Fecha" type="date" value={viewForm.fecha} onChange={(e) => updateViewField("fecha", e.target.value)} />
                  <Input label="Telefono" value={viewForm.numero_telefono} onChange={(e) => updateViewField("numero_telefono", e.target.value)} />
                  <Input label="CURP" value={viewForm.curp} onChange={(e) => updateViewField("curp", e.target.value)} maxLength={18} />
                  <Input label="NSS" value={viewForm.nss} onChange={(e) => updateViewField("nss", e.target.value)} maxLength={15} />
                  <Input label="RFC" value={viewForm.rfc} onChange={(e) => updateViewField("rfc", e.target.value)} maxLength={13} />
                </div>
              </div>

              {/* Seccion: Clasificacion */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Clasificacion</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Select label="Status" value={viewForm.status} onChange={(e) => updateViewField("status", e.target.value)} options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
                    {viewForm.status && <Badge color={getColor(STATUS_COLORS, viewForm.status)} className="mt-2">{viewForm.status}</Badge>}
                  </div>
                  <div>
                    <Select label="Etapa" value={viewForm.etapa} onChange={(e) => updateViewField("etapa", e.target.value)} options={ETAPA_OPTIONS.map((e) => ({ value: e, label: e }))} />
                    {viewForm.etapa && <Badge color={getColor(ETAPA_COLORS, viewForm.etapa)} className="mt-2">{viewForm.etapa}</Badge>}
                  </div>
                  <div>
                    <Select label="Estrategia" value={viewForm.estrategia} onChange={(e) => updateViewField("estrategia", e.target.value)} placeholder="Seleccionar..." options={ESTRATEGIA_OPTIONS.map((s) => ({ value: s, label: s }))} />
                    {viewForm.estrategia && <Badge color={getColor(ESTRATEGIA_COLORS, viewForm.estrategia)} className="mt-2">{viewForm.estrategia}</Badge>}
                  </div>
                  <div>
                    <Select label="Campaña" value={viewForm.campana} onChange={(e) => updateViewField("campana", e.target.value)} placeholder="Seleccionar..." options={CAMPANA_OPTIONS.map((s) => ({ value: s, label: s }))} />
                    {viewForm.campana && <Badge color={getColor(CAMPANA_COLORS, viewForm.campana)} className="mt-2">{viewForm.campana}</Badge>}
                  </div>
                  <div>
                    <Select label="Convenio" value={viewForm.convenio} onChange={(e) => updateViewField("convenio", e.target.value)} placeholder="Seleccionar..." options={CONVENIO_OPTIONS.map((s) => ({ value: s, label: s }))} />
                    {viewForm.convenio && <Badge color={getColor(CONVENIO_COLORS, viewForm.convenio)} className="mt-2">{viewForm.convenio}</Badge>}
                  </div>
                  <Select label="Flujo" value={viewForm.flujo} onChange={(e) => updateViewField("flujo", e.target.value)} placeholder="Seleccionar..." options={FLUJO_OPTIONS.map((s) => ({ value: s, label: s }))} />
                </div>
              </div>

              {/* Seccion: Credito */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Credito</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Input label="Capacidad" value={viewForm.capacidad} onChange={(e) => updateViewField("capacidad", e.target.value)} />
                  <Input label="Monto de Credito" type="number" value={viewForm.monto_credito} onChange={(e) => updateViewField("monto_credito", e.target.value)} />
                  <Select label="Tipo de Credito" value={viewForm.tipo_credito} onChange={(e) => updateViewField("tipo_credito", e.target.value)} placeholder="Seleccionar..." options={TIPO_CREDITO_OPTIONS.map((s) => ({ value: s, label: s }))} />
                  <Select label="Etiqueta" value={viewForm.etiqueta} onChange={(e) => updateViewField("etiqueta", e.target.value)} placeholder="Seleccionar..." options={ETIQUETA_OPTIONS.map((s) => ({ value: s, label: s }))} />
                  <Select label="Oferta" value={viewForm.oferta} onChange={(e) => updateViewField("oferta", e.target.value)} placeholder="Seleccionar..." options={OFERTA_OPTIONS.map((s) => ({ value: s, label: s }))} />
                  <Input label="Zona" value={viewForm.zona} onChange={(e) => updateViewField("zona", e.target.value)} />
                </div>
              </div>

              {/* Seccion: Venta */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Venta</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Input label="ID Venta" value={viewForm.id_venta} onChange={(e) => updateViewField("id_venta", e.target.value)} />
                  <Input label="Viabilidad" value={viewForm.viabilidad} onChange={(e) => updateViewField("viabilidad", e.target.value)} />
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Motivo</label>
                <textarea
                  className="w-full rounded-lg bg-slate-900/50 border border-slate-700/60 text-slate-200 px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-colors
                    placeholder:text-slate-600 min-h-[80px]"
                  value={viewForm.motivo}
                  onChange={(e) => updateViewField("motivo", e.target.value)}
                  placeholder="Motivo o notas adicionales..."
                />
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setViewRecord(null)}>Cerrar</Button>
          {viewDirty && (
            <Button
              variant="primary"
              icon={<Save className="w-4 h-4" />}
              loading={viewSaving}
              onClick={handleViewSave}
            >
              Guardar Cambios
            </Button>
          )}
        </DialogFooter>
      </Dialog>

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
            <Input label="Nombre del Cliente *" value={formData.nombre_cliente} onChange={(e) => updateField("nombre_cliente", e.target.value)} required />
            <Input label="Fecha" type="date" value={formData.fecha} onChange={(e) => updateField("fecha", e.target.value)} />
            <Select label="Status" value={formData.status} onChange={(e) => updateField("status", e.target.value)} options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Select label="Etapa" value={formData.etapa} onChange={(e) => updateField("etapa", e.target.value)} options={ETAPA_OPTIONS.map((e) => ({ value: e, label: e }))} />
            <Select label="Estrategia" value={formData.estrategia} onChange={(e) => updateField("estrategia", e.target.value)} placeholder="Seleccionar..." options={ESTRATEGIA_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Select label="Flujo" value={formData.flujo} onChange={(e) => updateField("flujo", e.target.value)} placeholder="Seleccionar..." options={FLUJO_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Input label="Numero Telefono" value={formData.numero_telefono} onChange={(e) => updateField("numero_telefono", e.target.value)} />
            <Input label="CURP" value={formData.curp} onChange={(e) => updateField("curp", e.target.value)} maxLength={18} />
            <Input label="NSS" value={formData.nss} onChange={(e) => updateField("nss", e.target.value)} maxLength={15} />
            <Input label="RFC" value={formData.rfc} onChange={(e) => updateField("rfc", e.target.value)} maxLength={13} />
            <Input label="Zona" value={formData.zona} onChange={(e) => updateField("zona", e.target.value)} />
            <Select label="Campaña" value={formData.campana} onChange={(e) => updateField("campana", e.target.value)} placeholder="Seleccionar..." options={CAMPANA_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Input label="Capacidad" value={formData.capacidad} onChange={(e) => updateField("capacidad", e.target.value)} />
            <Input label="Monto de Credito" type="number" value={formData.monto_credito} onChange={(e) => updateField("monto_credito", e.target.value)} />
            <Select label="Tipo de Credito" value={formData.tipo_credito} onChange={(e) => updateField("tipo_credito", e.target.value)} placeholder="Seleccionar..." options={TIPO_CREDITO_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Select label="Convenio" value={formData.convenio} onChange={(e) => updateField("convenio", e.target.value)} placeholder="Seleccionar..." options={CONVENIO_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Select label="Etiqueta" value={formData.etiqueta} onChange={(e) => updateField("etiqueta", e.target.value)} placeholder="Seleccionar..." options={ETIQUETA_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Select label="Oferta" value={formData.oferta} onChange={(e) => updateField("oferta", e.target.value)} placeholder="Seleccionar..." options={OFERTA_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Input label="ID Venta" value={formData.id_venta} onChange={(e) => updateField("id_venta", e.target.value)} />
            <Input label="Viabilidad" value={formData.viabilidad} onChange={(e) => updateField("viabilidad", e.target.value)} />
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
