"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeColor } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import {
  Plus, Trash2, Search, Save, Calendar,
  ShoppingCart, UserCheck, FileText, XCircle, Clock, HelpCircle,
  ChevronDown, Eye,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
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

// ─── Constants ───────────────────────────────────────────────────────
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
  facebook: "blue", VoxImplant: "purple", Wasapi: "emerald", WasapiCNCA: "teal",
  WasapiNuevo: "green", Consunomina: "red", Organico: "orange",
};

const CAMPANA_COLORS: Record<string, BadgeColor> = {
  "IMSS Pensionados": "blue", SNTE23: "purple", SEIEM: "teal", CDMX: "orange",
  "SNTE17y36": "amber", GEM: "green", IMSS: "emerald", "Nuevo Leon": "red", SNTE14: "yellow",
};

const ETAPA_COLORS: Record<string, BadgeColor> = {
  Leads: "blue", Cotizacion: "amber", "No sujeto a credito": "red", Ventas: "green",
};

const CONVENIO_COLORS: Record<string, BadgeColor> = {
  "IMSS Pensionados": "blue", GEM: "green", CDMX: "orange", "IMSS Jubilados": "teal",
  INE: "purple", SEIEM: "emerald", SEP: "amber", SNTE23: "purple",
  "Gob Chihuahua": "red", "Gob Nuevo Leon": "red", SNTE14: "yellow", SEDUC: "teal", SNTE21: "orange",
};

function getColor(map: Record<string, BadgeColor>, value: string | null | undefined): BadgeColor {
  if (!value) return "slate";
  if (map[value]) return map[value];
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  for (const [key, color] of Object.entries(map)) {
    if (key.toLowerCase().replace(/\s+/g, "") === normalized) return color;
  }
  return "slate";
}

// ─── Status pipeline config (inline styles to avoid Tailwind purge) ──
const STATUS_PIPELINE: {
  key: string; label: string;
  rgb: string; // base color as rgb for inline styles
  icon: typeof ShoppingCart;
}[] = [
  { key: "Venta", label: "Venta", rgb: "34,197,94", icon: ShoppingCart },
  { key: "Interesado", label: "Interesado", rgb: "59,130,246", icon: UserCheck },
  { key: "Cotizacion", label: "Cotizacion", rgb: "245,158,11", icon: FileText },
  { key: "No viable", label: "No viable", rgb: "239,68,68", icon: XCircle },
  { key: "Proceso", label: "Proceso", rgb: "168,85,247", icon: Clock },
  { key: "Sin informacion", label: "Sin info", rgb: "148,163,184", icon: HelpCircle },
];

const EMPTY_FORM = {
  etapa: "Leads", nombre_cliente: "", fecha: new Date().toISOString().split("T")[0],
  status: "Sin informacion", estrategia: "", flujo: "", numero_telefono: "",
  curp: "", nss: "", rfc: "", zona: "", campana: "", capacidad: "",
  monto_credito: "", tipo_credito: "", convenio: "", etiqueta: "", oferta: "",
  motivo: "", id_venta: "", viabilidad: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────
const fmtCurrency = (v: number | null) =>
  v != null ? v.toLocaleString("es-MX", { style: "currency", currency: "MXN" }) : "\u2014";

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("es-MX") : "\u2014";

const cell = (v: string | null | undefined) => v || "\u2014";

// ─── Table columns definition ────────────────────────────────────────
const TABLE_COLS: {
  key: string;
  label: string;
  width: string;
  sticky?: boolean;
  render: (r: Registro) => React.ReactNode;
}[] = [
  {
    key: "nombre_cliente", label: "Cliente", width: "min-w-[180px]", sticky: true,
    render: () => null, // handled separately for click
  },
  {
    key: "numero_telefono", label: "Telefono", width: "min-w-[130px]",
    render: (r) => <span className="text-slate-400">{cell(r.numero_telefono)}</span>,
  },
  {
    key: "fecha", label: "Fecha", width: "min-w-[100px]",
    render: (r) => <span className="text-slate-400">{fmtDate(r.fecha)}</span>,
  },
  {
    key: "etapa", label: "Etapa", width: "min-w-[140px]",
    render: (r) => r.etapa ? <Badge color={getColor(ETAPA_COLORS, r.etapa)}>{r.etapa}</Badge> : <span className="text-slate-600">&mdash;</span>,
  },
  {
    key: "estrategia", label: "Estrategia", width: "min-w-[130px]",
    render: (r) => r.estrategia ? <Badge color={getColor(ESTRATEGIA_COLORS, r.estrategia)}>{r.estrategia}</Badge> : <span className="text-slate-600">&mdash;</span>,
  },
  {
    key: "campana", label: "Campana", width: "min-w-[150px]",
    render: (r) => r.campana ? <Badge color={getColor(CAMPANA_COLORS, r.campana)}>{r.campana}</Badge> : <span className="text-slate-600">&mdash;</span>,
  },
  {
    key: "convenio", label: "Convenio", width: "min-w-[150px]",
    render: (r) => r.convenio ? <Badge color={getColor(CONVENIO_COLORS, r.convenio)}>{r.convenio}</Badge> : <span className="text-slate-600">&mdash;</span>,
  },
  {
    key: "monto_credito", label: "Monto Credito", width: "min-w-[140px]",
    render: (r) => <span className="text-slate-300 font-medium tabular-nums">{fmtCurrency(r.monto_credito)}</span>,
  },
  {
    key: "tipo_credito", label: "Tipo Credito", width: "min-w-[130px]",
    render: (r) => <span className="text-slate-400">{cell(r.tipo_credito)}</span>,
  },
  {
    key: "capacidad", label: "Capacidad", width: "min-w-[120px]",
    render: (r) => <span className="text-slate-400">{cell(r.capacidad)}</span>,
  },
  {
    key: "flujo", label: "Flujo", width: "min-w-[120px]",
    render: (r) => <span className="text-slate-400">{cell(r.flujo)}</span>,
  },
  {
    key: "etiqueta", label: "Etiqueta", width: "min-w-[110px]",
    render: (r) => <span className="text-slate-400">{cell(r.etiqueta)}</span>,
  },
  {
    key: "oferta", label: "Oferta", width: "min-w-[90px]",
    render: (r) => <span className="text-slate-400">{cell(r.oferta)}</span>,
  },
  {
    key: "zona", label: "Zona", width: "min-w-[100px]",
    render: (r) => <span className="text-slate-400">{cell(r.zona)}</span>,
  },
  {
    key: "curp", label: "CURP", width: "min-w-[170px]",
    render: (r) => <span className="text-slate-500 font-mono text-[11px]">{cell(r.curp)}</span>,
  },
  {
    key: "nss", label: "NSS", width: "min-w-[130px]",
    render: (r) => <span className="text-slate-500 font-mono text-[11px]">{cell(r.nss)}</span>,
  },
  {
    key: "rfc", label: "RFC", width: "min-w-[140px]",
    render: (r) => <span className="text-slate-500 font-mono text-[11px]">{cell(r.rfc)}</span>,
  },
  {
    key: "id_venta", label: "ID Venta", width: "min-w-[120px]",
    render: (r) => <span className="text-slate-400">{cell(r.id_venta)}</span>,
  },
  {
    key: "viabilidad", label: "Viabilidad", width: "min-w-[110px]",
    render: (r) => <span className="text-slate-400">{cell(r.viabilidad)}</span>,
  },
  {
    key: "motivo", label: "Motivo", width: "min-w-[180px]",
    render: (r) => (
      <span className="text-slate-500 text-xs truncate block max-w-[180px]" title={r.motivo || ""}>
        {cell(r.motivo)}
      </span>
    ),
  },
];

// ─── Main Page ───────────────────────────────────────────────────────
export default function AsesorDigitalPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Registro | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewRecord, setViewRecord] = useState<Registro | null>(null);
  const [viewForm, setViewForm] = useState<Record<string, string>>({});
  const [viewDirty, setViewDirty] = useState(false);
  const [viewSaving, setViewSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const { toast } = useToast();

  const [filtroPeriodo, setFiltroPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());

  const [formData, setFormData] = useState(EMPTY_FORM);

  // ─── Data fetching (server-side period filter) ───────────────────
  const fetchRegistros = useCallback(async (periodo?: string) => {
    setLoading(true);
    try {
      const params = periodo ? `?periodo=${periodo}` : "";
      const res = await fetch(`/api/asesor-digital/registros${params}`);
      if (!res.ok) throw new Error("Error al cargar registros");
      const data = await res.json();
      setRegistros(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchRegistros(filtroPeriodo); }, [fetchRegistros, filtroPeriodo]);

  // ─── Filtered & grouped data ──────────────────────────────────────
  const registrosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return registros;
    const term = busqueda.toLowerCase();
    return registros.filter((r) =>
      r.nombre_cliente.toLowerCase().includes(term) ||
      (r.numero_telefono && r.numero_telefono.includes(term)) ||
      (r.nss && r.nss.includes(term)) ||
      (r.curp && r.curp.toLowerCase().includes(term))
    );
  }, [registros, busqueda]);

  const conteos = useMemo(() => {
    const c: Record<string, number> = {};
    STATUS_PIPELINE.forEach((s) => (c[s.key] = 0));
    registrosFiltrados.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [registrosFiltrados]);

  const registrosPorStatus = useMemo(() => {
    const map: Record<string, Registro[]> = {};
    STATUS_PIPELINE.forEach((s) => (map[s.key] = []));
    registrosFiltrados.forEach((r) => {
      if (map[r.status]) map[r.status].push(r);
    });
    return map;
  }, [registrosFiltrados]);

  // ─── Accordion toggle ─────────────────────────────────────────────
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setFormData({ ...EMPTY_FORM, fecha: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };

  const buildBody = (form: Record<string, string>) => ({
    ...form,
    monto_credito: form.monto_credito ? Number(form.monto_credito) : null,
    estrategia: form.estrategia || null, flujo: form.flujo || null,
    numero_telefono: form.numero_telefono || null, curp: form.curp || null,
    nss: form.nss || null, rfc: form.rfc || null, zona: form.zona || null,
    campana: form.campana || null, capacidad: form.capacidad || null,
    tipo_credito: form.tipo_credito || null, convenio: form.convenio || null,
    etiqueta: form.etiqueta || null, oferta: form.oferta || null,
    motivo: form.motivo || null, id_venta: form.id_venta || null,
    viabilidad: form.viabilidad || null,
  });

  const handleSave = async () => {
    if (!formData.nombre_cliente.trim()) {
      toast("El nombre del cliente es obligatorio", "error");
      return;
    }
    const url = editingRecord ? `/api/asesor-digital/registros/${editingRecord.id}` : "/api/asesor-digital/registros";
    const method = editingRecord ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildBody(formData)) });
    if (res.ok) {
      setDialogOpen(false);
      toast(editingRecord ? "Registro actualizado" : "Registro creado", "success");
      fetchRegistros(filtroPeriodo);
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    const res = await fetch(`/api/asesor-digital/registros/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      toast("Registro eliminado", "success");
      setDeleteConfirmId(null);
      fetchRegistros(filtroPeriodo);
    } else {
      toast("Error al eliminar", "error");
    }
  };

  const updateField = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const openViewRecord = (record: Registro) => {
    setViewRecord(record);
    setViewForm({
      nombre_cliente: record.nombre_cliente,
      fecha: record.fecha ? record.fecha.split("T")[0] : "",
      status: record.status, etapa: record.etapa,
      estrategia: record.estrategia || "", flujo: record.flujo || "",
      numero_telefono: record.numero_telefono || "",
      curp: record.curp || "", nss: record.nss || "", rfc: record.rfc || "",
      zona: record.zona || "", campana: record.campana || "",
      capacidad: record.capacidad || "",
      monto_credito: record.monto_credito ? String(record.monto_credito) : "",
      tipo_credito: record.tipo_credito || "", convenio: record.convenio || "",
      etiqueta: record.etiqueta || "", oferta: record.oferta || "",
      motivo: record.motivo || "", id_venta: record.id_venta || "",
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
    const res = await fetch(`/api/asesor-digital/registros/${viewRecord.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(viewForm)),
    });
    setViewSaving(false);
    if (res.ok) {
      toast("Registro actualizado", "success");
      setViewDirty(false);
      setViewRecord(null);
      fetchRegistros(filtroPeriodo);
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="font-display text-xl font-bold text-slate-100">Mis Registros</h1>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>
          Nuevo Registro
        </Button>
      </div>

      {/* Search + period */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Buscar por nombre, telefono, NSS, CURP..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-300" />
          <input
            type="month"
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="rounded-lg bg-slate-900/50 border border-slate-700/60 text-slate-200 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-colors"
          />
        </div>
        {!loading && (
          <p className="text-xs text-slate-500 pb-2">
            {registrosFiltrados.length} registro{registrosFiltrados.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8 text-amber-500" />
        </div>
      )}

      {/* Accordion cards by status */}
      {!loading && (
        <div className="space-y-4 w-full">
          {STATUS_PIPELINE.map((s) => {
            const Icon = s.icon;
            const items = registrosPorStatus[s.key] || [];
            const isExpanded = expandedSections.has(s.key);
            const count = items.length;
            const c = s.rgb;

            return (
              <div
                key={s.key}
                className="rounded-2xl overflow-hidden transition-all duration-200 w-full"
                style={{
                  border: `1px solid rgba(${c}, ${isExpanded ? 0.4 : 0.15})`,
                  backgroundColor: isExpanded ? `rgba(${c}, 0.06)` : "rgb(15,23,42)",
                }}
              >
                {/* Gradient accent top */}
                <div className="h-[2px]" style={{ background: `linear-gradient(to right, rgba(${c},0.8), rgba(${c},0.3))` }} />

                {/* Card header */}
                <button
                  onClick={() => toggleSection(s.key)}
                  className="w-full flex items-center gap-4 px-5 py-4 transition-colors text-left"
                  style={{ backgroundColor: isExpanded ? `rgba(${c}, 0.08)` : undefined }}
                >
                  <div className={`transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
                    <ChevronDown className="w-5 h-5" style={{ color: `rgb(${c})` }} />
                  </div>
                  <Icon className="w-5 h-5" style={{ color: `rgb(${c})` }} />
                  <span className="font-display font-bold text-base" style={{ color: `rgb(${c})` }}>
                    {s.label}
                  </span>
                  <Badge color={getColor(STATUS_COLORS, s.key)}>
                    {count} {count === 1 ? "registro" : "registros"}
                  </Badge>
                  <div className="flex-1" />
                  {!isExpanded && count > 0 && (
                    <span className="text-xs text-slate-600">Clic para expandir</span>
                  )}
                </button>

                {/* Expanded content: table */}
                {isExpanded && (
                  <div className="px-3 pb-4 w-full overflow-hidden">
                    {count === 0 ? (
                      <div className="text-center py-8">
                        <Icon className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: `rgb(${c})` }} />
                        <p className="text-sm text-slate-600">Sin registros en este status</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-800/40 overflow-auto max-h-[420px] w-full">
                        <table style={{ minWidth: 1800 }} className="w-full text-sm">
                          <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-900">
                              <th className="sticky left-0 z-30 bg-slate-900 text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40" style={{ minWidth: 180 }}>
                                Cliente
                              </th>
                              {TABLE_COLS.filter((col) => col.key !== "nombre_cliente").map((col) => (
                                <th
                                  key={col.key}
                                  className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 whitespace-nowrap bg-slate-900"
                                >
                                  {col.label}
                                </th>
                              ))}
                              <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 bg-slate-900" style={{ minWidth: 90 }}>
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/30">
                            {items.map((r, idx) => (
                              <tr
                                key={r.id}
                                className={`transition-colors group ${idx % 2 === 0 ? "bg-transparent" : "bg-slate-900/20"} hover:bg-slate-800/30`}
                              >
                                <td className="sticky left-0 z-10 bg-slate-950 px-4 py-3 border-r border-slate-800/20 group-hover:bg-slate-800/30 transition-colors" style={{ minWidth: 180 }}>
                                  <button
                                    onClick={() => openViewRecord(r)}
                                    className="text-sm font-medium text-slate-200 hover:text-amber-400 transition-colors text-left"
                                  >
                                    {r.nombre_cliente}
                                  </button>
                                </td>
                                {TABLE_COLS.filter((col) => col.key !== "nombre_cliente").map((col) => (
                                  <td key={col.key} className="px-4 py-3 text-sm whitespace-nowrap">
                                    {col.render(r)}
                                  </td>
                                ))}
                                <td className="px-3 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => openViewRecord(r)}
                                      title="Ver detalle"
                                      className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(r.id)}
                                      title="Eliminar"
                                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Dialog detalle/edicion ─────────────────────────────────── */}
      <Dialog open={viewRecord !== null} onClose={() => setViewRecord(null)} maxWidth="2xl">
        <DialogHeader onClose={() => setViewRecord(null)}>
          <div className="flex items-center gap-3 flex-wrap">
            <span>{viewForm.nombre_cliente || viewRecord?.nombre_cliente}</span>
            {viewForm.status && <Badge color={getColor(STATUS_COLORS, viewForm.status)}>{viewForm.status}</Badge>}
            {viewForm.etapa && <Badge color={getColor(ETAPA_COLORS, viewForm.etapa)}>{viewForm.etapa}</Badge>}
          </div>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto space-y-6">
          {viewRecord && (
            <>
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
                    <Select label="Campana" value={viewForm.campana} onChange={(e) => updateViewField("campana", e.target.value)} placeholder="Seleccionar..." options={CAMPANA_OPTIONS.map((s) => ({ value: s, label: s }))} />
                    {viewForm.campana && <Badge color={getColor(CAMPANA_COLORS, viewForm.campana)} className="mt-2">{viewForm.campana}</Badge>}
                  </div>
                  <div>
                    <Select label="Convenio" value={viewForm.convenio} onChange={(e) => updateViewField("convenio", e.target.value)} placeholder="Seleccionar..." options={CONVENIO_OPTIONS.map((s) => ({ value: s, label: s }))} />
                    {viewForm.convenio && <Badge color={getColor(CONVENIO_COLORS, viewForm.convenio)} className="mt-2">{viewForm.convenio}</Badge>}
                  </div>
                  <Select label="Flujo" value={viewForm.flujo} onChange={(e) => updateViewField("flujo", e.target.value)} placeholder="Seleccionar..." options={FLUJO_OPTIONS.map((s) => ({ value: s, label: s }))} />
                </div>
              </div>
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
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Venta</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Input label="ID Venta" value={viewForm.id_venta} onChange={(e) => updateViewField("id_venta", e.target.value)} />
                  <Input label="Viabilidad" value={viewForm.viabilidad} onChange={(e) => updateViewField("viabilidad", e.target.value)} />
                </div>
              </div>
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
            <Button variant="primary" icon={<Save className="w-4 h-4" />} loading={viewSaving} onClick={handleViewSave}>
              Guardar Cambios
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      {/* ─── Dialog confirmar eliminacion ────────────────────────────── */}
      <Dialog open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} maxWidth="sm">
        <DialogHeader onClose={() => setDeleteConfirmId(null)}>Confirmar Eliminacion</DialogHeader>
        <DialogBody>
          <p className="text-slate-300">¿Estas seguro de que deseas eliminar este registro? Esta accion no se puede deshacer.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} disabled={deletingId !== null}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} loading={deletingId !== null}>Eliminar</Button>
        </DialogFooter>
      </Dialog>

      {/* ─── Dialog crear/editar ─────────────────────────────────────── */}
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
            <Select label="Campana" value={formData.campana} onChange={(e) => updateField("campana", e.target.value)} placeholder="Seleccionar..." options={CAMPANA_OPTIONS.map((s) => ({ value: s, label: s }))} />
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
