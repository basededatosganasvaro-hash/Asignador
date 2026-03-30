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
import { ClipboardCheck, FileSpreadsheet, Download } from "lucide-react";

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
    // No hay lote — mostrar botón para solicitar
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

  const clienteNombre = tipo === "IEPPO"
    ? `${(item.cliente as Record<string, unknown>)?.nombres ?? ""} ${(item.cliente as Record<string, unknown>)?.a_paterno ?? ""}`.trim()
    : String((item.cliente as Record<string, unknown>)?.nombre ?? "Sin nombre");

  const handleSave = async () => {
    if (!capacidad.trim()) {
      toast("La capacidad es requerida", "error");
      return;
    }
    if (!retroId) {
      toast("Selecciona retroalimentación", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/promotor/calificacion/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono,
          capacidad,
          retroalimentacion_id: Number(retroId),
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
      toast("Error de conexión", "error");
    } finally {
      setSaving(false);
    }
  };

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
              <p><span className="text-slate-500">Institución:</span> {String((item.cliente as Record<string, unknown>)?.institucion ?? "—")}</p>
              <p><span className="text-slate-500">Nómina:</span> {String((item.cliente as Record<string, unknown>)?.nomina ?? "—")}</p>
              <p><span className="text-slate-500">Servicio:</span> {String((item.cliente as Record<string, unknown>)?.servicio ?? "—")}</p>
            </>
          )}
        </div>

        {/* Campos de calificación */}
        <div className="space-y-3">
          <Input
            label="Teléfono"
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
            label="Retroalimentación"
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
