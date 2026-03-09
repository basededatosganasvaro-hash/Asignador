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
  Users, ChevronDown, Eye, ArrowRightLeft,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
interface RegistroRS {
  id: number;
  nombre_cliente: string;
  fecha: string;
  estrategia: string;
  numero_telefono: string | null;
  curp: string | null;
  status: string;
  viabilidad: string | null;
  motivo: string | null;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────
const ESTRATEGIA_OPTIONS = ["Facebook", "Wasapi", "Vox implant", "Organico", "Consunomina"];
const STATUS_OPTIONS = [
  "Venta", "Interesado", "No interesado", "Cotizacion", "No localizado",
  "Sin capacidad", "En proceso", "Sin informacion", "No apto", "Analisis", "Declinó",
];
const VIABILIDAD_OPTIONS = ["Viable", "No viable"];

const STATUS_COLORS: Record<string, BadgeColor> = {
  Venta: "green", Interesado: "blue", "No interesado": "red", Cotizacion: "amber",
  "No localizado": "slate", "Sin capacidad": "orange", "En proceso": "purple",
  "Sin informacion": "slate", "No apto": "red", Analisis: "teal", "Declinó": "red",
};

const ESTRATEGIA_COLORS: Record<string, BadgeColor> = {
  Facebook: "blue", Wasapi: "emerald", "Vox implant": "purple", Organico: "green", Consunomina: "red",
};

const VIABILIDAD_COLORS: Record<string, BadgeColor> = {
  Viable: "green", "No viable": "red",
};

function getColor(map: Record<string, BadgeColor>, value: string | null | undefined): BadgeColor {
  if (!value) return "slate";
  return map[value] || "slate";
}

const EMPTY_FORM = {
  nombre_cliente: "", fecha: new Date().toISOString().split("T")[0],
  estrategia: "Facebook", numero_telefono: "", curp: "",
  status: "Sin informacion", viabilidad: "", motivo: "",
};

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("es-MX") : "\u2014";

const cell = (v: string | null | undefined) => v || "\u2014";

// ─── Main Page ───────────────────────────────────────────────────────
export default function RedesSocialesPage() {
  const [registros, setRegistros] = useState<RegistroRS[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [transferConfirmId, setTransferConfirmId] = useState<number | null>(null);
  const [transferringId, setTransferringId] = useState<number | null>(null);
  const [viewRecord, setViewRecord] = useState<RegistroRS | null>(null);
  const [viewForm, setViewForm] = useState<Record<string, string>>({});
  const [viewDirty, setViewDirty] = useState(false);
  const [viewSaving, setViewSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const { toast } = useToast();

  const [filtroPeriodo, setFiltroPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // ─── Data fetching ──────────────────────────────────────────────────
  const fetchRegistros = useCallback(async (periodo?: string) => {
    setLoading(true);
    try {
      const params = periodo ? `?periodo=${periodo}` : "";
      const res = await fetch(`/api/asesor-digital/redes-sociales${params}`);
      if (!res.ok) throw new Error("Error al cargar registros");
      setRegistros(await res.json());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchRegistros(filtroPeriodo); }, [fetchRegistros, filtroPeriodo]);

  // ─── Filtered data ─────────────────────────────────────────────────
  const registrosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return registros;
    const term = busqueda.toLowerCase();
    return registros.filter((r) =>
      r.nombre_cliente.toLowerCase().includes(term) ||
      (r.numero_telefono && r.numero_telefono.includes(term)) ||
      (r.curp && r.curp.toLowerCase().includes(term))
    );
  }, [registros, busqueda]);

  // ─── Handlers ───────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setFormData({ ...EMPTY_FORM, fecha: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };

  const buildBody = (form: Record<string, string>) => ({
    nombre_cliente: form.nombre_cliente,
    fecha: form.fecha,
    estrategia: form.estrategia,
    numero_telefono: form.numero_telefono || null,
    curp: form.curp || null,
    status: form.status,
    viabilidad: form.viabilidad || null,
    motivo: form.motivo || null,
  });

  const handleSave = async () => {
    if (!formData.nombre_cliente.trim()) {
      toast("El nombre del cliente es obligatorio", "error");
      return;
    }
    const res = await fetch("/api/asesor-digital/redes-sociales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(formData)),
    });
    if (res.ok) {
      setDialogOpen(false);
      toast("Registro creado", "success");
      fetchRegistros(filtroPeriodo);
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    const res = await fetch(`/api/asesor-digital/redes-sociales/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      toast("Registro eliminado", "success");
      setDeleteConfirmId(null);
      fetchRegistros(filtroPeriodo);
    } else {
      toast("Error al eliminar", "error");
    }
  };

  const handleTransfer = async (id: number) => {
    setTransferringId(id);
    const res = await fetch(`/api/asesor-digital/redes-sociales/${id}/transferir`, { method: "POST" });
    setTransferringId(null);
    if (res.ok) {
      toast("Registro transferido a Mis Registros", "success");
      setTransferConfirmId(null);
      fetchRegistros(filtroPeriodo);
    } else {
      const data = await res.json();
      toast(data.error || "Error al transferir", "error");
    }
  };

  const updateField = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const openViewRecord = (record: RegistroRS) => {
    setViewRecord(record);
    setViewForm({
      nombre_cliente: record.nombre_cliente,
      fecha: record.fecha ? record.fecha.split("T")[0] : "",
      estrategia: record.estrategia,
      numero_telefono: record.numero_telefono || "",
      curp: record.curp || "",
      status: record.status,
      viabilidad: record.viabilidad || "",
      motivo: record.motivo || "",
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
    const res = await fetch(`/api/asesor-digital/redes-sociales/${viewRecord.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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

  // ─── Card color (cyan/teal for Leads) ───────────────────────────────
  const c = "6,182,212"; // cyan-500

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="font-display text-xl font-bold text-slate-100">Redes Sociales</h1>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>
          Nuevo Lead
        </Button>
      </div>

      {/* Search + period */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Buscar por nombre, telefono, CURP..."
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
            {registrosFiltrados.length} lead{registrosFiltrados.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8 text-amber-500" />
        </div>
      )}

      {/* Leads card */}
      {!loading && (
        <div className="space-y-4 w-full">
          <div
            className="rounded-2xl overflow-hidden transition-all duration-200 w-full"
            style={{
              border: `1px solid rgba(${c}, ${expanded ? 0.4 : 0.15})`,
              backgroundColor: expanded ? `rgba(${c}, 0.06)` : "rgb(15,23,42)",
            }}
          >
            <div className="h-[2px]" style={{ background: `linear-gradient(to right, rgba(${c},0.8), rgba(${c},0.3))` }} />

            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center gap-4 px-5 py-4 transition-colors text-left"
              style={{ backgroundColor: expanded ? `rgba(${c}, 0.08)` : undefined }}
            >
              <div className={`transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}>
                <ChevronDown className="w-5 h-5" style={{ color: `rgb(${c})` }} />
              </div>
              <Users className="w-5 h-5" style={{ color: `rgb(${c})` }} />
              <span className="font-display font-bold text-base" style={{ color: `rgb(${c})` }}>
                Leads
              </span>
              <Badge color="teal">
                {registrosFiltrados.length} {registrosFiltrados.length === 1 ? "registro" : "registros"}
              </Badge>
              <div className="flex-1" />
              {!expanded && registrosFiltrados.length > 0 && (
                <span className="text-xs text-slate-600">Clic para expandir</span>
              )}
            </button>

            {expanded && (
              <div className="px-3 pb-4 w-full overflow-hidden">
                {registrosFiltrados.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: `rgb(${c})` }} />
                    <p className="text-sm text-slate-600">Sin leads en este periodo</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-800/40 overflow-auto max-h-[420px] w-full">
                    <table style={{ minWidth: 1200 }} className="w-full text-sm">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-slate-900">
                          <th className="sticky left-0 z-30 bg-slate-900 text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40" style={{ minWidth: 180 }}>
                            Cliente
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 whitespace-nowrap bg-slate-900">Fecha</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 whitespace-nowrap bg-slate-900">Estrategia</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 whitespace-nowrap bg-slate-900">Telefono</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 whitespace-nowrap bg-slate-900">CURP</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 whitespace-nowrap bg-slate-900">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 whitespace-nowrap bg-slate-900">Viabilidad</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 whitespace-nowrap bg-slate-900">Motivo</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/40 bg-slate-900" style={{ minWidth: 120 }}>
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {registrosFiltrados.map((r, idx) => (
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
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <span className="text-slate-400">{fmtDate(r.fecha)}</span>
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <Badge color={getColor(ESTRATEGIA_COLORS, r.estrategia)}>{r.estrategia}</Badge>
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <span className="text-slate-400">{cell(r.numero_telefono)}</span>
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <span className="text-slate-500 font-mono text-[11px]">{cell(r.curp)}</span>
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <Badge color={getColor(STATUS_COLORS, r.status)}>{r.status}</Badge>
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              {r.viabilidad ? (
                                <Badge color={getColor(VIABILIDAD_COLORS, r.viabilidad)}>{r.viabilidad}</Badge>
                              ) : (
                                <span className="text-slate-600">&mdash;</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <span className="text-slate-500 text-xs truncate block max-w-[180px]" title={r.motivo || ""}>
                                {cell(r.motivo)}
                              </span>
                            </td>
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
                                  onClick={() => setTransferConfirmId(r.id)}
                                  title="Transferir a Mis Registros"
                                  className="p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
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
        </div>
      )}

      {/* ─── Dialog detalle/edicion ─────────────────────────────────── */}
      <Dialog open={viewRecord !== null} onClose={() => setViewRecord(null)} maxWidth="lg">
        <DialogHeader onClose={() => setViewRecord(null)}>
          <div className="flex items-center gap-3 flex-wrap">
            <span>{viewForm.nombre_cliente || viewRecord?.nombre_cliente}</span>
            {viewForm.status && <Badge color={getColor(STATUS_COLORS, viewForm.status)}>{viewForm.status}</Badge>}
            {viewForm.estrategia && <Badge color={getColor(ESTRATEGIA_COLORS, viewForm.estrategia)}>{viewForm.estrategia}</Badge>}
          </div>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto space-y-6">
          {viewRecord && (
            <>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Datos del Lead</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nombre del Cliente" value={viewForm.nombre_cliente} onChange={(e) => updateViewField("nombre_cliente", e.target.value)} />
                  <Input label="Fecha" type="date" value={viewForm.fecha} onChange={(e) => updateViewField("fecha", e.target.value)} />
                  <Input label="Telefono" value={viewForm.numero_telefono} onChange={(e) => updateViewField("numero_telefono", e.target.value)} />
                  <Input label="CURP" value={viewForm.curp} onChange={(e) => updateViewField("curp", e.target.value)} maxLength={18} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Clasificacion</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Select label="Estrategia" value={viewForm.estrategia} onChange={(e) => updateViewField("estrategia", e.target.value)} options={ESTRATEGIA_OPTIONS.map((s) => ({ value: s, label: s }))} />
                    {viewForm.estrategia && <Badge color={getColor(ESTRATEGIA_COLORS, viewForm.estrategia)} className="mt-2">{viewForm.estrategia}</Badge>}
                  </div>
                  <div>
                    <Select label="Status" value={viewForm.status} onChange={(e) => updateViewField("status", e.target.value)} options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
                    {viewForm.status && <Badge color={getColor(STATUS_COLORS, viewForm.status)} className="mt-2">{viewForm.status}</Badge>}
                  </div>
                  <div>
                    <Select label="Viabilidad" value={viewForm.viabilidad} onChange={(e) => updateViewField("viabilidad", e.target.value)} placeholder="Seleccionar..." options={VIABILIDAD_OPTIONS.map((s) => ({ value: s, label: s }))} />
                    {viewForm.viabilidad && <Badge color={getColor(VIABILIDAD_COLORS, viewForm.viabilidad)} className="mt-2">{viewForm.viabilidad}</Badge>}
                  </div>
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
          <p className="text-slate-300">¿Estas seguro de que deseas eliminar este lead? Esta accion no se puede deshacer.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} disabled={deletingId !== null}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} loading={deletingId !== null}>Eliminar</Button>
        </DialogFooter>
      </Dialog>

      {/* ─── Dialog confirmar transferencia ──────────────────────────── */}
      <Dialog open={transferConfirmId !== null} onClose={() => setTransferConfirmId(null)} maxWidth="sm">
        <DialogHeader onClose={() => setTransferConfirmId(null)}>Transferir Lead</DialogHeader>
        <DialogBody>
          <p className="text-slate-300">
            ¿Deseas transferir este lead a <strong className="text-amber-400">Mis Registros</strong>?
            El lead sera eliminado de Redes Sociales y dado de alta en tu tabla principal.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setTransferConfirmId(null)} disabled={transferringId !== null}>Cancelar</Button>
          <Button variant="primary" icon={<ArrowRightLeft className="w-4 h-4" />} loading={transferringId !== null} onClick={() => transferConfirmId && handleTransfer(transferConfirmId)}>
            Transferir
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ─── Dialog crear ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg">
        <DialogHeader onClose={() => setDialogOpen(false)}>Nuevo Lead</DialogHeader>
        <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre del Cliente *" value={formData.nombre_cliente} onChange={(e) => updateField("nombre_cliente", e.target.value)} required />
            <Input label="Fecha" type="date" value={formData.fecha} onChange={(e) => updateField("fecha", e.target.value)} />
            <Select label="Estrategia" value={formData.estrategia} onChange={(e) => updateField("estrategia", e.target.value)} options={ESTRATEGIA_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Input label="Numero Telefono" value={formData.numero_telefono} onChange={(e) => updateField("numero_telefono", e.target.value)} />
            <Input label="CURP" value={formData.curp} onChange={(e) => updateField("curp", e.target.value)} maxLength={18} />
            <Select label="Status" value={formData.status} onChange={(e) => updateField("status", e.target.value)} options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
            <Select label="Viabilidad" value={formData.viabilidad} onChange={(e) => updateField("viabilidad", e.target.value)} placeholder="Seleccionar..." options={VIABILIDAD_OPTIONS.map((s) => ({ value: s, label: s }))} />
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
          <Button variant="primary" onClick={handleSave}>Crear</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
