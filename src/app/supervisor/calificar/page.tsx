"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { DataTable, createSelectionColumn } from "@/components/ui/DataTable";
import { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Download, ClipboardCheck, Inbox, Users } from "lucide-react";

// ─── Types ───

interface ClienteData {
  id: number;
  curp?: string;
  nombres?: string;
  a_paterno?: string;
  a_materno?: string;
  nss?: string;
  tel_1?: string;
  filiacion?: string;
  capacidad?: string;
  capacidad_actualizada?: string;
  percepciones_fijas?: string;
  descuentos_terceros?: string;
  estatus_laboral?: string;
  fecha_ingreso?: string;
  estatus_calificacion?: string;
  convenio?: string;
  estado?: string;
  municipio?: string;
}

interface CalificacionItem {
  id: number;
  cliente_id: number;
  calificado: boolean;
  cliente: ClienteData | null;
}

interface LoteInfo {
  id: number;
  fecha: string;
  cantidad: number;
  estado: string;
  total_calificados: number;
  total_pendientes: number;
}

interface PoolItem {
  id: number;
  cliente_id: number;
  expira_at: string;
  created_at: string;
  cliente: ClienteData | null;
}

interface Promotor {
  id: number;
  nombre: string;
  cupoRestante: number;
  cupoMaximo: number;
  oportunidadesActivas: number;
}

interface Opciones {
  tipoCliente: string;
  convenios: string[];
  estados: string[];
  municipios: string[];
  disponibles: number;
}

// ─── Tab buttons ───

const TABS = [
  { key: "solicitar", label: "Solicitar Lote", icon: <Download className="w-4 h-4" /> },
  { key: "lote", label: "Mi Lote", icon: <ClipboardCheck className="w-4 h-4" /> },
  { key: "pool", label: "Mi Pool", icon: <Inbox className="w-4 h-4" /> },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Page ───

export default function SupervisorCalificarPage() {
  const [tab, setTab] = useState<TabKey>("solicitar");
  const { toast } = useToast();

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-slate-100 mb-4">Calificar y Asignar</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800/60 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.key
                ? "text-amber-400 bg-slate-800/50 border-b-2 border-amber-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "solicitar" && <SolicitarTab toast={toast} onCreated={() => setTab("lote")} />}
      {tab === "lote" && <MiLoteTab toast={toast} />}
      {tab === "pool" && <MiPoolTab toast={toast} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1: Solicitar Lote
// ═══════════════════════════════════════════════════════════════════════════════

function SolicitarTab({ toast, onCreated }: { toast: ReturnType<typeof useToast>["toast"]; onCreated: () => void }) {
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [loadingOpc, setLoadingOpc] = useState(false);
  const [convenio, setConvenio] = useState("");
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [rangoOferta, setRangoOferta] = useState("");
  const [tieneTelefono, setTieneTelefono] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchOpciones = useCallback(async () => {
    setLoadingOpc(true);
    const params = new URLSearchParams();
    if (convenio) params.set("convenio", convenio);
    if (estado) params.set("estado", estado);
    if (municipio) params.set("municipio", municipio);
    if (rangoOferta) params.set("rango_oferta", rangoOferta);
    if (tieneTelefono) params.set("tiene_telefono", "1");

    try {
      const res = await fetch(`/api/supervisor/calificar/opciones?${params}`);
      if (res.ok) setOpciones(await res.json());
    } catch {
      toast("Error cargando opciones", "error");
    }
    setLoadingOpc(false);
  }, [convenio, estado, municipio, rangoOferta, tieneTelefono, toast]);

  useEffect(() => {
    const timer = setTimeout(fetchOpciones, 300);
    return () => clearTimeout(timer);
  }, [fetchOpciones]);

  const handleSubmit = async () => {
    const cant = parseInt(cantidad) || opciones?.disponibles || 0;
    if (cant < 1) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/supervisor/calificar/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cantidad: cant,
          convenio: convenio || undefined,
          estado: estado || undefined,
          municipio: municipio || undefined,
          rango_oferta: rangoOferta || undefined,
          tiene_telefono: tieneTelefono,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast(`Lote creado: ${data.cantidad} registros`, "success");
        onCreated();
      } else {
        const data = await res.json();
        toast(data.error || "Error al crear lote", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setSubmitting(false);
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Solicitar Lote para Calificar</h2>
      <p className="text-sm text-slate-500 mb-4">
        Tipo de cliente: <span className="text-amber-400 font-medium">Compilado Cartera</span> (fijo)
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Select
          label="Convenio"
          value={convenio}
          onChange={(e) => { setConvenio(e.target.value); setEstado(""); setMunicipio(""); }}
          options={(opciones?.convenios || []).map((c) => ({ value: c, label: c }))}
          placeholder="Todos"
        />
        <Select
          label="Estado"
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setMunicipio(""); }}
          options={(opciones?.estados || []).map((e) => ({ value: e, label: e }))}
          placeholder="Todos"
        />
        <Select
          label="Municipio"
          value={municipio}
          onChange={(e) => setMunicipio(e.target.value)}
          options={(opciones?.municipios || []).map((m) => ({ value: m, label: m }))}
          placeholder="Todos"
          disabled={!estado}
        />
        <Select
          label="Rango de oferta"
          value={rangoOferta}
          onChange={(e) => setRangoOferta(e.target.value)}
          options={[
            { value: "0-50000", label: "$0 - $50,000" },
            { value: "50000-100000", label: "$50,000 - $100,000" },
            { value: "100000-500000", label: "$100,000 - $500,000" },
            { value: "500000+", label: "$500,000+" },
          ]}
          placeholder="Todos"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={tieneTelefono}
          onChange={(e) => setTieneTelefono(e.target.checked)}
          className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/40"
        />
        Solo con telefono
      </label>

      <div className="border-t border-slate-800/60 pt-4 flex flex-wrap items-center gap-4">
        <div className="w-36">
          <Input
            label="Cantidad"
            type="number"
            min={1}
            max={opciones?.disponibles || 9999}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={String(opciones?.disponibles || 0)}
          />
        </div>
        <div className="text-sm text-slate-400">
          Disponibles: <span className="text-slate-200 font-bold">{loadingOpc ? "..." : opciones?.disponibles ?? 0}</span>
        </div>
        <Button
          variant="primary"
          icon={<Download className="w-4 h-4" />}
          onClick={handleSubmit}
          disabled={submitting || !opciones || opciones.disponibles === 0}
          loading={submitting}
        >
          Solicitar Lote
        </Button>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2: Mi Lote (calificación)
// ═══════════════════════════════════════════════════════════════════════════════

function MiLoteTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [lote, setLote] = useState<LoteInfo | null>(null);
  const [clientes, setClientes] = useState<CalificacionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [editItem, setEditItem] = useState<CalificacionItem | null>(null);
  const [formCap, setFormCap] = useState("");
  const [formTel, setFormTel] = useState("");
  const [formEstatus, setFormEstatus] = useState("");
  const [formFecha, setFormFecha] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingNoLoc, setSavingNoLoc] = useState(false);

  const fetchLote = useCallback(async () => {
    try {
      const res = await fetch("/api/supervisor/calificar/mi-lote");
      if (res.ok) {
        const data = await res.json();
        setLote(data.lote);
        setClientes(data.clientes);
      }
    } catch {
      toast("Error al cargar lote", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchLote(); }, [fetchLote]);

  const handleOpenEdit = (item: CalificacionItem) => {
    setEditItem(item);
    setFormCap(item.cliente?.capacidad_actualizada || "");
    setFormTel(item.cliente?.tel_1 || "");
    setFormEstatus(item.cliente?.estatus_laboral || "");
    setFormFecha(item.cliente?.fecha_ingreso || "");
  };

  const handleSave = async () => {
    if (!editItem) return;
    const numVal = parseFloat(formCap);
    if (isNaN(numVal) || numVal < 0) { toast("Capacidad invalida", "error"); return; }
    if (!formEstatus) { toast("Estatus requerido", "error"); return; }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(formFecha)) { toast("Formato dd/mm/aaaa", "error"); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/supervisor/calificar/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacidad_actualizada: numVal.toFixed(2),
          tel_1: formTel.trim() || undefined,
          estatus_laboral: formEstatus,
          fecha_ingreso: formFecha,
        }),
      });
      if (res.ok) {
        toast("Registro calificado — enviado al pool", "success");
        setEditItem(null);
        fetchLote();
      } else {
        const data = await res.json();
        toast(data.error || "Error al calificar", "error");
      }
    } catch { toast("Error de conexion", "error"); }
    setSaving(false);
  };

  const handleNoLocalizado = async () => {
    if (!editItem) return;
    setSavingNoLoc(true);
    try {
      const res = await fetch(`/api/supervisor/calificar/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ no_localizado: true }),
      });
      if (res.ok) {
        toast("Marcado como no localizado", "success");
        setEditItem(null);
        fetchLote();
      } else {
        const data = await res.json();
        toast(data.error || "Error", "error");
      }
    } catch { toast("Error de conexion", "error"); }
    setSavingNoLoc(false);
  };

  const columns: ColumnDef<CalificacionItem, unknown>[] = useMemo(() => [
    {
      id: "nombre",
      header: "Nombre",
      size: 220,
      accessorFn: (row) => {
        const c = row.cliente;
        if (!c) return "—";
        return [c.nombres, c.a_paterno, c.a_materno].filter(Boolean).join(" ");
      },
      cell: ({ row, getValue }) => (
        <button
          onClick={() => handleOpenEdit(row.original)}
          className="text-left text-amber-400 hover:text-amber-300 hover:underline transition-colors"
        >
          {getValue() as string}
        </button>
      ),
    },
    { id: "curp", header: "CURP", size: 180, accessorFn: (row) => row.cliente?.curp ?? "—" },
    {
      id: "filiacion", header: "Filiación", size: 130,
      accessorFn: (row) => row.cliente?.filiacion ?? "—",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={v === "—" ? "text-slate-500" : "text-slate-200"}>{v}</span>;
      },
    },
    {
      id: "percepciones_fijas", header: "Perc. Fijas", size: 130,
      accessorFn: (row) => row.cliente?.percepciones_fijas ?? "—",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (v === "—") return <span className="text-slate-500">—</span>;
        const n = parseFloat(v);
        return <span className="text-slate-200">{isNaN(n) ? v : `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}</span>;
      },
    },
    {
      id: "descuentos_terceros", header: "Desc. Terceros", size: 140,
      accessorFn: (row) => row.cliente?.descuentos_terceros ?? "—",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (v === "—") return <span className="text-slate-500">—</span>;
        const n = parseFloat(v);
        return <span className="text-slate-200">{isNaN(n) ? v : `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}</span>;
      },
    },
    {
      id: "capacidad_actualizada", header: "Capacidad (MXN)", size: 150,
      accessorFn: (row) => row.cliente?.capacidad_actualizada ?? "—",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (v === "—") return <span className="text-slate-500">—</span>;
        const n = parseFloat(v);
        return <span className="text-amber-400 font-medium">{isNaN(n) ? v : `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}</span>;
      },
    },
    {
      id: "estatus", header: "Estatus", size: 110,
      accessorFn: (row) => row.cliente?.estatus_laboral ?? "—",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (v === "—") return <span className="text-slate-500">—</span>;
        return <Badge color={v === "Estable" ? "green" : "amber"}>{v}</Badge>;
      },
    },
    {
      id: "status", header: "Estado", size: 130,
      cell: ({ row }) => (
        <Badge color={row.original.calificado ? "green" : "slate"}>
          {row.original.calificado ? "Calificado" : "Pendiente"}
        </Badge>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (!lote) {
    return (
      <div className="text-center py-16">
        <ClipboardCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-slate-300 mb-2">Sin lote activo</h2>
        <p className="text-slate-500">Solicita un lote desde la pestaña &quot;Solicitar Lote&quot;.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Mi Lote de Calificación</h2>
          <p className="text-sm text-slate-500">
            {new Date(lote.fecha).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-slate-800/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{lote.cantidad}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-slate-800/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Calificados</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{lote.total_calificados}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-slate-800/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Pendientes</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{lote.total_pendientes}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-slate-800/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Avance</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">
            {lote.cantidad > 0 ? Math.round((lote.total_calificados / lote.cantidad) * 100) : 0}%
          </p>
        </div>
      </div>

      <DataTable data={clientes} columns={columns} loading={false} pageSize={25} pageSizeOptions={[25, 50, 100]} />

      {/* Dialog calificar */}
      <Dialog open={!!editItem} onClose={() => setEditItem(null)} maxWidth="sm">
        <DialogHeader onClose={() => setEditItem(null)}>Calificar Registro</DialogHeader>
        <DialogBody className="space-y-4">
          {editItem?.cliente && (
            <div className="bg-slate-800/40 rounded-lg p-3 space-y-1">
              <p className="text-sm text-slate-300 font-medium">
                {[editItem.cliente.nombres, editItem.cliente.a_paterno, editItem.cliente.a_materno].filter(Boolean).join(" ")}
              </p>
              <p className="text-xs text-slate-500">CURP: {editItem.cliente.curp ?? "—"}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Filiación</label>
            <p className="px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300">
              {editItem?.cliente?.filiacion || "—"}
            </p>
          </div>
          <Input
            label="Capacidad Actualizada (MXN)"
            type="number"
            step="0.01"
            min="0"
            value={formCap}
            onChange={(e) => setFormCap(e.target.value)}
            required
            placeholder="Ej: 50000.00"
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Estatus <span className="text-red-400">*</span>
            </label>
            <select
              value={formEstatus}
              onChange={(e) => setFormEstatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="">Seleccionar...</option>
              <option value="Estable">Estable</option>
              <option value="No estable">No estable</option>
            </select>
          </div>
          <Input
            label="Fecha de Ingreso (dd/mm/aaaa)"
            value={formFecha}
            onChange={(e) => setFormFecha(e.target.value.replace(/[^\d/]/g, ""))}
            maxLength={10}
            required
            placeholder="dd/mm/aaaa"
          />
          <Input
            label="Teléfono (opcional)"
            value={formTel}
            onChange={(e) => setFormTel(e.target.value)}
            placeholder="Ej: 5512345678"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={handleNoLocalizado} disabled={savingNoLoc || saving} className="!text-red-400 hover:!bg-red-500/10 mr-auto">
            {savingNoLoc ? "Marcando..." : "Datos no localizados"}
          </Button>
          <Button variant="ghost" onClick={() => setEditItem(null)}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || savingNoLoc}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3: Mi Pool (asignación a promotores)
// ═══════════════════════════════════════════════════════════════════════════════

function MiPoolTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [items, setItems] = useState<PoolItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [loadingProms, setLoadingProms] = useState(false);
  const [selectedPromotor, setSelectedPromotor] = useState("");
  const [assigning, setAssigning] = useState(false);

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch("/api/supervisor/calificar/pool");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } catch {
      toast("Error al cargar pool", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchPool(); }, [fetchPool]);

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number);
  }, [rowSelection]);

  const selectedPoolIds = useMemo(() => {
    return selectedIds.map((idx) => items[idx]?.id).filter(Boolean);
  }, [selectedIds, items]);

  const handleOpenAssign = async () => {
    setAssignOpen(true);
    setSelectedPromotor("");
    setLoadingProms(true);
    try {
      const res = await fetch("/api/supervisor/asignaciones");
      if (res.ok) {
        const data = await res.json();
        setPromotores(data.promotores);
      }
    } catch {
      toast("Error cargando promotores", "error");
    }
    setLoadingProms(false);
  };

  const handleAssign = async () => {
    const promId = parseInt(selectedPromotor);
    if (!promId || selectedPoolIds.length === 0) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/supervisor/calificar/pool/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pool_ids: selectedPoolIds, promotor_id: promId }),
      });
      if (res.ok) {
        const data = await res.json();
        toast(`${data.asignados} registros asignados a ${data.promotor}`, "success");
        setAssignOpen(false);
        setRowSelection({});
        fetchPool();
      } else {
        const data = await res.json();
        toast(data.error || "Error al asignar", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setAssigning(false);
  };

  const columns: ColumnDef<PoolItem, unknown>[] = useMemo(() => [
    createSelectionColumn<PoolItem>(),
    {
      id: "nombre", header: "Nombre", size: 220,
      accessorFn: (row) => {
        const c = row.cliente;
        if (!c) return "—";
        return [c.nombres, c.a_paterno, c.a_materno].filter(Boolean).join(" ");
      },
    },
    { id: "curp", header: "CURP", size: 180, accessorFn: (row) => row.cliente?.curp ?? "—" },
    {
      id: "capacidad_actualizada", header: "Cap. Actualizada", size: 140,
      accessorFn: (row) => row.cliente?.capacidad_actualizada ?? "—",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (v === "—") return <span className="text-slate-500">—</span>;
        const n = parseFloat(v);
        return <span className="text-amber-400 font-semibold">{isNaN(n) ? v : `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}</span>;
      },
    },
    {
      id: "estatus_laboral", header: "Est. Laboral", size: 110,
      accessorFn: (row) => row.cliente?.estatus_laboral ?? "—",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (v === "—") return <span className="text-slate-500">—</span>;
        return <Badge color={v === "Estable" ? "green" : "amber"}>{v}</Badge>;
      },
    },
    {
      id: "filiacion", header: "Filiación", size: 120,
      accessorFn: (row) => row.cliente?.filiacion ?? "—",
    },
    {
      id: "tel_1", header: "Teléfono", size: 130,
      accessorFn: (row) => row.cliente?.tel_1 ?? "—",
    },
    {
      id: "created_at", header: "Calificado", size: 120,
      accessorFn: (row) => new Date(row.created_at).toLocaleDateString("es-MX"),
    },
  ], []);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-400">
          {total} registro{total !== 1 ? "s" : ""} en tu pool
          {selectedPoolIds.length > 0 && (
            <span className="text-amber-400 ml-2">({selectedPoolIds.length} seleccionados)</span>
          )}
        </p>
        <Button
          variant="primary"
          icon={<Users className="w-4 h-4" />}
          onClick={handleOpenAssign}
          disabled={selectedPoolIds.length === 0}
        >
          Asignar a Promotor
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <Inbox className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-300 mb-2">Pool vacio</h2>
          <p className="text-slate-500">Califica registros desde tu lote para llenar el pool.</p>
        </div>
      ) : (
        <DataTable
          data={items}
          columns={columns}
          loading={false}
          pageSize={25}
          pageSizeOptions={[25, 50, 100]}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      )}

      {/* Dialog asignar */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setAssignOpen(false)}>Asignar a Promotor</DialogHeader>
        <DialogBody>
          <p className="text-sm text-slate-400 mb-4">
            Asignando <strong className="text-amber-400">{selectedPoolIds.length}</strong> registros calificados.
          </p>
          {loadingProms ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : (
            <Select
              label="Promotor"
              value={selectedPromotor}
              onChange={(e) => setSelectedPromotor(e.target.value)}
              options={promotores.map((p) => ({
                value: String(p.id),
                label: `${p.nombre} — Cupo: ${p.cupoRestante}/${p.cupoMaximo} | Activas: ${p.oportunidadesActivas}`,
              }))}
              placeholder="Seleccionar promotor..."
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={handleAssign}
            disabled={assigning || !selectedPromotor}
            loading={assigning}
          >
            Asignar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
