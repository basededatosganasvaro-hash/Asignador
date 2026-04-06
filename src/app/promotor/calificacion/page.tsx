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
import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck, FileSpreadsheet, Download, Search, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Types ───

interface RetroItem {
  id: number;
  nombre: string;
}

interface CalificacionItem {
  id: number;
  cliente_id: number;
  calificado: boolean;
  telefono: string | null;
  capacidad: string | null;
  retroalimentacion: string | null;
  retroalimentacion_id: number | null;
  cliente: Record<string, unknown> | null;
}

interface LoteData {
  id: number;
  fecha: string;
  tipo: string;
  cantidad: number;
  estado: string;
  total_calificados: number;
  total_pendientes: number;
  items: CalificacionItem[];
}

interface CupoInfo {
  total_asignado: number;
  limite: number;
  disponible: number;
}

// ─── Tabs ───

const TABS = [
  { key: "IEPPO", label: "IEPPO", icon: <ClipboardCheck className="w-4 h-4" /> },
  { key: "CDMX", label: "CDMX", icon: <FileSpreadsheet className="w-4 h-4" /> },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Page ───

export default function PromotorCalificacionPage() {
  const [tab, setTab] = useState<TabKey>("IEPPO");
  const [lotes, setLotes] = useState<{ IEPPO: LoteData | null; CDMX: LoteData | null }>({
    IEPPO: null,
    CDMX: null,
  });
  const [cupo, setCupo] = useState<CupoInfo | null>(null);
  const [catalogo, setCatalogo] = useState<RetroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [lotesRes, cupoRes, catRes] = await Promise.all([
        fetch("/api/promotor/calificacion/mi-lote"),
        fetch("/api/promotor/calificacion/cupo"),
        fetch("/api/promotor/calificacion/catalogo"),
      ]);
      if (lotesRes.ok) {
        const data = await lotesRes.json();
        setLotes(data.lotes);
      }
      if (cupoRes.ok) {
        setCupo(await cupoRes.json());
      }
      if (catRes.ok) {
        setCatalogo(await catRes.json());
      }
    } catch {
      toast("Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-bold text-slate-100">Calificación de Datos</h1>
        {cupo && (
          <Badge color={cupo.disponible > 0 ? "blue" : "amber"}>
            Cupo: {cupo.total_asignado}/{cupo.limite}
          </Badge>
        )}
      </div>

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

      <TabContent
        tipo={tab}
        lote={lotes[tab]}
        cupo={cupo}
        catalogo={catalogo}
        toast={toast}
        onRefresh={fetchAll}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab Content (shared for IEPPO and CDMX)
// ═══════════════════════════════════════════════════════════════════════════════

function TabContent({
  tipo,
  lote,
  cupo,
  catalogo,
  toast,
  onRefresh,
}: {
  tipo: TabKey;
  lote: LoteData | null;
  cupo: CupoInfo | null;
  catalogo: RetroItem[];
  toast: ReturnType<typeof useToast>["toast"];
  onRefresh: () => void;
}) {
  const [showSolicitar, setShowSolicitar] = useState(false);
  const [cantidad, setCantidad] = useState("50");
  const [submitting, setSubmitting] = useState(false);
  const [editItem, setEditItem] = useState<CalificacionItem | null>(null);
  const [confirmLiberar, setConfirmLiberar] = useState(false);
  const [liberando, setLiberando] = useState(false);

  const handleLiberar = async () => {
    if (!lote) return;
    setLiberando(true);
    try {
      const res = await fetch("/api/promotor/calificacion/liberar-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lote_id: lote.id }),
      });
      if (res.ok) {
        const data = await res.json();
        toast(
          `Lote liberado: ${data.calificados} registros calificados`,
          "success"
        );
        setConfirmLiberar(false);
        onRefresh();
      } else {
        const data = await res.json();
        toast(data.error || "Error al liberar", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setLiberando(false);
  };

  const solicitarLote = async () => {
    const cant = Math.min(Number(cantidad) || 50, cupo?.disponible ?? 0);
    if (cant <= 0) {
      toast("Cupo agotado", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/promotor/calificacion/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, cantidad: cant }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Error al solicitar", "error");
        return;
      }
      toast(`Se asignaron ${data.cantidad} registros ${tipo}`, "success");
      setShowSolicitar(false);
      onRefresh();
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Columns vary by tipo
  const columns: ColumnDef<CalificacionItem>[] = useMemo(() => {
    const base: ColumnDef<CalificacionItem>[] = [
      {
        header: "#",
        cell: ({ row }) => row.index + 1,
        size: 50,
      },
    ];

    if (tipo === "IEPPO") {
      base.push(
        {
          header: "Nombre",
          accessorFn: (row) => {
            const c = row.cliente;
            if (!c) return "—";
            return `${c.nombres ?? ""} ${c.a_paterno ?? ""} ${c.a_materno ?? ""}`.trim();
          },
          cell: ({ row, getValue }) => (
            <button
              className="text-amber-400 hover:underline text-left"
              onClick={() => setEditItem(row.original)}
            >
              {getValue() as string}
            </button>
          ),
        },
        {
          header: "CURP",
          accessorFn: (row) => (row.cliente as Record<string, unknown>)?.curp ?? "—",
          size: 180,
        },
        {
          header: "Convenio",
          accessorFn: (row) => (row.cliente as Record<string, unknown>)?.convenio ?? "—",
          size: 150,
        },
        {
          header: "Estado",
          accessorFn: (row) => (row.cliente as Record<string, unknown>)?.estado ?? "—",
          size: 120,
        }
      );
    } else {
      // CDMX
      base.push(
        {
          header: "Nombre",
          accessorFn: (row) => (row.cliente as Record<string, unknown>)?.nombre ?? "—",
          cell: ({ row, getValue }) => (
            <button
              className="text-amber-400 hover:underline text-left"
              onClick={() => setEditItem(row.original)}
            >
              {getValue() as string}
            </button>
          ),
        },
        {
          header: "RFC",
          accessorFn: (row) => (row.cliente as Record<string, unknown>)?.rfc ?? "—",
          size: 140,
        },
        {
          header: "Institución",
          accessorFn: (row) => (row.cliente as Record<string, unknown>)?.institucion ?? "—",
          size: 180,
        },
        {
          header: "Puesto",
          accessorFn: (row) => {
            const puesto = (row.cliente as Record<string, unknown>)?.puesto;
            if (!puesto) return "—";
            const s = String(puesto);
            return s.length > 40 ? s.substring(0, 40) + "…" : s;
          },
          size: 200,
        }
      );
    }

    // Shared columns
    base.push(
      {
        header: "Teléfono",
        accessorFn: (row) => row.telefono ?? "—",
        size: 120,
      },
      {
        header: "Capacidad",
        accessorFn: (row) => row.capacidad ?? "—",
        size: 110,
      },
      {
        header: "Retroalimentación",
        accessorFn: (row) => row.retroalimentacion ?? "—",
        cell: ({ getValue }) => {
          const val = getValue() as string;
          if (val === "—") return <span className="text-slate-500">—</span>;
          const colorMap: Record<string, "green" | "amber" | "blue" | "red" | "slate"> = {
            Contesto: "green",
            "No contesto": "amber",
            Interesado: "blue",
            "No interesado": "red",
            "No localizado": "slate",
          };
          return <Badge color={colorMap[val] ?? "slate"}>{val}</Badge>;
        },
        size: 150,
      },
      {
        header: "Estado",
        accessorFn: (row) => (row.calificado ? "Calificado" : "Pendiente"),
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return (
            <Badge color={val === "Calificado" ? "green" : "slate"}>
              {val}
            </Badge>
          );
        },
        size: 100,
      }
    );

    return base;
  }, [tipo]);

  if (!lote) {
    // CDMX: mostrar selector de clientes
    if (tipo === "CDMX") {
      return (
        <CdmxSelector
          cupo={cupo}
          toast={toast}
          onRefresh={onRefresh}
        />
      );
    }

    // IEPPO: flujo original con cantidad
    return (
      <Card className="p-8 text-center">
        <div className="text-slate-400 mb-4">
          No tienes un lote {tipo} activo.
          {cupo && cupo.disponible > 0
            ? ` Puedes solicitar hasta ${cupo.disponible} registros.`
            : " Tu cupo diario está agotado."}
        </div>
        {cupo && cupo.disponible > 0 && (
          <>
            <Button onClick={() => setShowSolicitar(true)}>
              <Download className="w-4 h-4 mr-2" />
              Solicitar Lote {tipo}
            </Button>
            <SolicitarDialog
              open={showSolicitar}
              onClose={() => setShowSolicitar(false)}
              tipo={tipo}
              maxCantidad={cupo.disponible}
              cantidad={cantidad}
              setCantidad={setCantidad}
              submitting={submitting}
              onSubmit={solicitarLote}
            />
          </>
        )}
      </Card>
    );
  }

  // Hay lote activo
  const porcentaje = lote.cantidad > 0
    ? Math.round((lote.total_calificados / lote.cantidad) * 100)
    : 0;

  return (
    <div>
      {/* Header con botón liberar */}
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setConfirmLiberar(true)}
          disabled={lote.total_pendientes > 0}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            lote.total_pendientes > 0
              ? "bg-slate-700/30 text-slate-500 border border-slate-700/40 cursor-not-allowed"
              : "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 hover:border-red-500/50"
          }`}
        >
          Liberar Lote
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total" value={lote.cantidad} />
        <KpiCard label="Calificados" value={lote.total_calificados} color="text-emerald-400" />
        <KpiCard label="Pendientes" value={lote.total_pendientes} color="text-amber-400" />
        <KpiCard label="Avance" value={`${porcentaje}%`} color="text-blue-400" />
      </div>

      {/* DataTable */}
      <DataTable columns={columns} data={lote.items} pageSize={20} />

      {/* Dialog de calificación */}
      {editItem && (
        <CalificarDialog
          item={editItem}
          tipo={tipo}
          catalogo={catalogo}
          toast={toast}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null);
            onRefresh();
          }}
        />
      )}

      {/* Dialog confirmar liberar lote */}
      <Dialog open={confirmLiberar} onClose={() => setConfirmLiberar(false)} maxWidth="sm">
        <DialogHeader onClose={() => setConfirmLiberar(false)}>
          Liberar Lote {tipo}
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-slate-300">
            Se liberaran <strong className="text-emerald-400">{lote.total_calificados}</strong> registros
            calificados de vuelta al pool de asignacion.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            La calificacion y retroalimentacion quedaran en el historico. Esta accion no se puede deshacer.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmLiberar(false)} disabled={liberando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleLiberar} loading={liberando}>
            Confirmar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Solicitar Dialog
// ═══════════════════════════════════════════════════════════════════════════════

function SolicitarDialog({
  open,
  onClose,
  tipo,
  maxCantidad,
  cantidad,
  setCantidad,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  tipo: string;
  maxCantidad: number;
  cantidad: string;
  setCantidad: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>Solicitar Lote {tipo}</DialogHeader>
      <DialogBody>
        <p className="text-sm text-slate-400 mb-3">
          Indica cuántos registros deseas calificar. Máximo disponible: <strong>{maxCantidad}</strong>
        </p>
        <Input
          label="Cantidad"
          type="number"
          min={1}
          max={maxCantidad}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} loading={submitting}>
          Solicitar
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Calificar Dialog
// ═══════════════════════════════════════════════════════════════════════════════

function CalificarDialog({
  item,
  tipo,
  catalogo,
  toast,
  onClose,
  onSaved,
}: {
  item: CalificacionItem;
  tipo: string;
  catalogo: RetroItem[];
  toast: ReturnType<typeof useToast>["toast"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [telefono, setTelefono] = useState(item.telefono ?? "");
  const [capacidad, setCapacidad] = useState(item.capacidad ?? "");
  const [retroId, setRetroId] = useState(item.retroalimentacion_id?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [showSinRegistro, setShowSinRegistro] = useState(false);

  const clienteNombre = tipo === "IEPPO"
    ? `${(item.cliente as Record<string, unknown>)?.nombres ?? ""} ${(item.cliente as Record<string, unknown>)?.a_paterno ?? ""}`.trim()
    : String((item.cliente as Record<string, unknown>)?.nombre ?? "Sin nombre");

  const doSave = async (tel: string, cap: string, retro: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/promotor/calificacion/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: tel,
          capacidad: cap,
          retroalimentacion_id: retro,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Error al guardar", "error");
        return;
      }
      toast("Registro calificado", "success");
      onSaved();
    } catch {
      toast("Error de conexion", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!retroId) {
      toast("Selecciona retroalimentacion", "error");
      return;
    }

    // Si no hay telefono, preguntar si no encontro el dato
    if (!telefono.trim()) {
      setShowSinRegistro(true);
      return;
    }

    if (!capacidad.trim()) {
      toast("La capacidad es requerida", "error");
      return;
    }

    await doSave(telefono, capacidad, Number(retroId));
  };

  const handleSinRegistro = async () => {
    // Buscar "No localizado" en catalogo para auto-asignar retro
    const noLoc = catalogo.find((c) => c.nombre.toLowerCase().includes("no localizado"));
    const retro = retroId ? Number(retroId) : noLoc ? noLoc.id : null;
    if (!retro) {
      toast("Selecciona retroalimentacion", "error");
      setShowSinRegistro(false);
      return;
    }
    await doSave("Sin registro", capacidad.trim() || "Sin registro", retro);
  };

  // Sub-dialog: sin registro
  if (showSinRegistro) {
    return (
      <Dialog open onClose={() => setShowSinRegistro(false)} maxWidth="sm">
        <DialogHeader onClose={() => setShowSinRegistro(false)}>
          Sin numero de telefono
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-slate-300">
            No ingresaste un numero de telefono para este registro.
          </p>
          <p className="text-sm text-slate-400 mt-2">
            ¿Calificaste el dato o no encontraste la informacion?
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowSinRegistro(false)} disabled={saving}>
            Volver
          </Button>
          <Button
            variant="primary"
            onClick={handleSinRegistro}
            loading={saving}
          >
            No encontre el dato
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>Calificar — {clienteNombre}</DialogHeader>
      <DialogBody>
        {/* Datos del cliente (solo lectura) */}
        <div className="bg-slate-800/40 rounded-lg p-3 mb-4 text-sm text-slate-300 space-y-1">
          {tipo === "IEPPO" ? (
            <>
              <p><span className="text-slate-500">CURP:</span> {String((item.cliente as Record<string, unknown>)?.curp ?? "—")}</p>
              <p><span className="text-slate-500">Convenio:</span> {String((item.cliente as Record<string, unknown>)?.convenio ?? "—")}</p>
              <p><span className="text-slate-500">Estado:</span> {String((item.cliente as Record<string, unknown>)?.estado ?? "—")}</p>
              <p><span className="text-slate-500">Capacidad original:</span> {String((item.cliente as Record<string, unknown>)?.capacidad ?? "—")}</p>
            </>
          ) : (
            <>
              <p><span className="text-slate-500">RFC:</span> {String((item.cliente as Record<string, unknown>)?.rfc ?? "—")}</p>
              <p><span className="text-slate-500">Institucion:</span> {String((item.cliente as Record<string, unknown>)?.institucion ?? "—")}</p>
              <p><span className="text-slate-500">Nomina:</span> {String((item.cliente as Record<string, unknown>)?.nomina ?? "—")}</p>
              <p><span className="text-slate-500">Servicio:</span> {String((item.cliente as Record<string, unknown>)?.servicio ?? "—")}</p>
            </>
          )}
        </div>

        {/* Campos de calificación */}
        <div className="space-y-3">
          <Input
            label="Telefono"
            type="tel"
            placeholder="Ej: 5512345678"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
          <Input
            label="Capacidad (monto disponible)"
            type="text"
            placeholder="Ej: 15000"
            value={capacidad}
            onChange={(e) => setCapacidad(e.target.value)}
          />
          <Select
            label="Retroalimentacion"
            value={retroId}
            onChange={(e) => setRetroId(e.target.value)}
            options={[
              { label: "Seleccionar...", value: "" },
              ...catalogo.map((c) => ({ label: c.nombre, value: String(c.id) })),
            ]}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} loading={saving}>
          Guardar
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CDMX Client Selector (server-side paginated)
// ═══════════════════════════════════════════════════════════════════════════════

interface CdmxCliente {
  id: number;
  nombre: string | null;
  rfc: string | null;
  institucion: string | null;
  puesto: string | null;
  nomina: string | null;
  servicio: string | null;
}

function CdmxSelector({
  cupo,
  toast,
  onRefresh,
}: {
  cupo: CupoInfo | null;
  toast: ReturnType<typeof useToast>["toast"];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [clientes, setClientes] = useState<CdmxCliente[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const limit = 25;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch clients
  useEffect(() => {
    let cancelled = false;
    const fetchClientes = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await fetch(`/api/promotor/calificacion/cdmx-disponibles?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setClientes(data.clientes);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      } catch {
        if (!cancelled) toast("Error al cargar clientes CDMX", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchClientes();
    return () => { cancelled = true; };
  }, [page, debouncedSearch, toast]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageAll = () => {
    const pageIds = clientes.map((c) => c.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSolicitar = async () => {
    if (selected.size === 0) {
      toast("Selecciona al menos un cliente", "error");
      return;
    }
    if (cupo && selected.size > cupo.disponible) {
      toast(`Solo tienes cupo para ${cupo.disponible} registros`, "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/promotor/calificacion/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "CDMX", cliente_ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Error al solicitar", "error");
        return;
      }
      toast(`Se asignaron ${data.cantidad} registros CDMX`, "success");
      onRefresh();
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const pageIds = clientes.map((c) => c.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const maxSelectable = cupo?.disponible ?? 0;

  if (cupo && cupo.disponible <= 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-slate-400">
          No tienes un lote CDMX activo. Tu cupo diario está agotado.
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, RFC o institución..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-3">
          <Badge color={selected.size > 0 ? "amber" : "slate"}>
            {selected.size} seleccionados
          </Badge>
          {maxSelectable > 0 && (
            <span className="text-xs text-slate-500">Máx: {maxSelectable}</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-slate-800/60 overflow-hidden">
        <div className="overflow-auto scrollbar-thin max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/40 border-b border-slate-800/40 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePageAll}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800/50 text-amber-500 focus:ring-amber-500/40"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">RFC</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Institución</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Puesto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Servicio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 text-sm">
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                clientes.map((c) => {
                  const isSelected = selected.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-surface-hover transition-colors cursor-pointer ${isSelected ? "bg-amber-500/5" : ""}`}
                      onClick={() => toggleSelect(c.id)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800/50 text-amber-500 focus:ring-amber-500/40"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-200">{c.nombre ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{c.rfc ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{c.institucion ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{c.puesto ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{c.servicio ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="px-4 py-3 border-t border-slate-800/40 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {(page - 1) * limit + 1}-{Math.min(page * limit, total)} de {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-700 text-slate-300 rounded-lg disabled:opacity-30 hover:bg-surface-hover transition-colors font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-sm text-slate-500 px-3">
                {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-700 text-slate-300 rounded-lg disabled:opacity-30 hover:bg-surface-hover transition-colors font-medium"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 mt-3 p-3 bg-slate-900/95 backdrop-blur border border-slate-800/60 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge color="amber">{selected.size} clientes seleccionados</Badge>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Limpiar selección
            </button>
          </div>
          <Button onClick={handleSolicitar} loading={submitting}>
            <Download className="w-4 h-4 mr-2" />
            Solicitar Lote CDMX
          </Button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════════════════════════════════

function KpiCard({ label, value, color = "text-slate-100" }: { label: string; value: string | number; color?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </Card>
  );
}
