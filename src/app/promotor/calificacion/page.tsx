"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { ClipboardCheck, FileSpreadsheet, Download, Search, ChevronLeft, ChevronRight, Filter, X, Check, Users } from "lucide-react";
import { useSession } from "next-auth/react";

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
  curp: string | null;
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
  { key: "CDMX", label: "CDMX", icon: <FileSpreadsheet className="w-4 h-4" /> },
  { key: "PENSIONADOS", label: "Pensionados", icon: <Users className="w-4 h-4" /> },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Page ───

export default function PromotorCalificacionPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos_calificacion ?? [];
  const allowedTabs = useMemo(() => TABS.filter((t) => permisos.includes(t.key)), [permisos]);

  const [tab, setTab] = useState<TabKey>("CDMX");
  const [lotes, setLotes] = useState<{ IEPPO: LoteData | null; CDMX: LoteData | null; PENSIONADOS: LoteData | null }>({
    IEPPO: null,
    CDMX: null,
    PENSIONADOS: null,
  });
  const [cupo, setCupo] = useState<CupoInfo | null>(null);
  const [catalogo, setCatalogo] = useState<RetroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Set initial tab to first allowed
  useEffect(() => {
    if (allowedTabs.length > 0 && !permisos.includes(tab)) {
      setTab(allowedTabs[0].key);
    }
  }, [allowedTabs, permisos, tab]);

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
      {allowedTabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <ClipboardCheck className="w-12 h-12 mb-3 text-slate-600" />
          <p className="text-lg font-medium text-slate-400">Sin permisos de calificación</p>
          <p className="text-sm mt-1">No tienes permisos asignados para calificar. Contacta a tu administrador.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-6 border-b border-slate-800/60 pb-1">
            {allowedTabs.map((t) => (
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
        </>
      )}
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
    } else if (tipo === "CDMX") {
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
    } else {
      // PENSIONADOS
      base.push(
        {
          header: "Nombre",
          accessorFn: (row) => {
            const c = row.cliente as Record<string, unknown>;
            if (!c) return "—";
            return `${c.nombre ?? ""} ${c.a_paterno ?? ""} ${c.a_materno ?? ""}`.trim();
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
          header: "NSS",
          accessorFn: (row) => (row.cliente as Record<string, unknown>)?.nss ?? "—",
          size: 120,
        },
        {
          header: "Zona",
          accessorFn: (row) => (row.cliente as Record<string, unknown>)?.zona ?? "—",
          size: 100,
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
    if (tipo === "CDMX") {
      return <CdmxSelector cupo={cupo} toast={toast} onRefresh={onRefresh} />;
    }
    if (tipo === "PENSIONADOS") {
      return <PensionadosSelector cupo={cupo} toast={toast} onRefresh={onRefresh} />;
    }
    return <IeppoSelector cupo={cupo} toast={toast} onRefresh={onRefresh} />;
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
  const [curp, setCurp] = useState(item.curp ?? "");
  const [retroId, setRetroId] = useState(item.retroalimentacion_id?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [showSinRegistro, setShowSinRegistro] = useState(false);

  const c = item.cliente as Record<string, unknown>;
  const clienteNombre = tipo === "IEPPO"
    ? `${c?.nombres ?? ""} ${c?.a_paterno ?? ""}`.trim()
    : tipo === "PENSIONADOS"
    ? `${c?.nombre ?? ""} ${c?.a_paterno ?? ""} ${c?.a_materno ?? ""}`.trim() || "Sin nombre"
    : String(c?.nombre ?? "Sin nombre");

  const doSave = async (tel: string, cap: string, retro: number, curpVal: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/promotor/calificacion/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: tel,
          capacidad: cap,
          curp: curpVal || null,
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

    if (tipo === "CDMX" && !curp.trim()) {
      toast("El CURP es requerido para CDMX", "error");
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

    await doSave(telefono, capacidad, Number(retroId), curp.trim().toUpperCase());
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
    await doSave("Sin registro", capacidad.trim() || "Sin registro", retro, curp.trim().toUpperCase());
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
    <Dialog open onClose={onClose} maxWidth={tipo === "CDMX" || tipo === "IEPPO" || tipo === "PENSIONADOS" ? "lg" : undefined}>
      <DialogHeader>Calificar — {clienteNombre}</DialogHeader>
      <DialogBody>
        {/* Datos del cliente (solo lectura) */}
        <div className="bg-slate-800/40 rounded-lg p-3 mb-4 text-sm text-slate-300 space-y-1">
          {tipo === "IEPPO" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {IEPPO_DETAIL_FIELDS.map(({ key, label }) => (
                <div key={key} className="py-1 border-b border-slate-800/30">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
                  <p className="text-sm text-slate-200 mt-0.5 break-words">
                    {formatIeppoValue((item.cliente as Record<string, unknown>)?.[key])}
                  </p>
                </div>
              ))}
            </div>
          ) : tipo === "CDMX" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {DETAIL_FIELDS.map(({ key, label }) => (
                <div key={key} className="py-1 border-b border-slate-800/30">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
                  <p className="text-sm text-slate-200 mt-0.5 break-words">
                    {formatCdmxValue(key, (item.cliente as Record<string, unknown>)?.[key])}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {PENSIONADO_CALIFICAR_FIELDS.map(({ key, label }) => (
                <div key={key} className="py-1 border-b border-slate-800/30">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
                  <p className="text-sm text-slate-200 mt-0.5 break-words">
                    {formatPensionadoValue(key, (item.cliente as Record<string, unknown>)?.[key])}
                  </p>
                </div>
              ))}
            </div>
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
          {tipo === "CDMX" && (
            <Input
              label="CURP"
              type="text"
              placeholder="Ej: XXXX000000XXXXXX00"
              value={curp}
              onChange={(e) => setCurp(e.target.value.toUpperCase())}
              maxLength={18}
            />
          )}
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

// ═══════════════════════════════════════════════════════════════════════════════
// IEPPO Selector
// ═══════════════════════════════════════════════════════════════════════════════

interface IeppoCliente {
  id: number;
  nombres: string | null;
  a_paterno: string | null;
  a_materno: string | null;
  curp: string | null;
  convenio: string | null;
  estado: string | null;
}

interface IeppoFilterState {
  convenio: string[];
  estado: string[];
}

interface IeppoFilterOptions {
  convenio: string[];
  estado: string[];
}

type IeppoFilterKey = keyof IeppoFilterState;

function IeppoSelector({
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
  const [clientes, setClientes] = useState<IeppoCliente[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [columnFilters, setColumnFilters] = useState<IeppoFilterState>({
    convenio: [],
    estado: [],
  });
  const [filterOptions, setFilterOptions] = useState<IeppoFilterOptions>({
    convenio: [],
    estado: [],
  });
  const limit = 25;

  // Fetch filter options once
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const res = await fetch("/api/promotor/calificacion/ieppo-disponibles/filtros");
        if (res.ok) {
          setFilterOptions(await res.json());
        }
      } catch {
        // silently fail
      }
    };
    fetchFilterOptions();
  }, []);

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
        if (columnFilters.convenio.length > 0) params.set("filter_convenio", columnFilters.convenio.join(","));
        if (columnFilters.estado.length > 0) params.set("filter_estado", columnFilters.estado.join(","));

        const res = await fetch(`/api/promotor/calificacion/ieppo-disponibles?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setClientes(data.clientes);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      } catch {
        if (!cancelled) toast("Error al cargar clientes IEPPO", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchClientes();
    return () => { cancelled = true; };
  }, [page, debouncedSearch, columnFilters, toast]);

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
        body: JSON.stringify({ tipo: "IEPPO", cliente_ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Error al solicitar", "error");
        return;
      }
      toast(`Se asignaron ${data.cantidad} registros IEPPO`, "success");
      onRefresh();
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const applyColumnFilter = (key: IeppoFilterKey, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [key]: values }));
    setPage(1);
  };

  const activeFilterCount = columnFilters.convenio.length + columnFilters.estado.length;

  const clearAllFilters = () => {
    setColumnFilters({ convenio: [], estado: [] });
    setPage(1);
  };

  const pageIds = clientes.map((c) => c.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const maxSelectable = cupo?.disponible ?? 0;

  if (cupo && cupo.disponible <= 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-slate-400">
          No tienes un lote IEPPO activo. Tu cupo diario está agotado.
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
            placeholder="Buscar por nombre, CURP o convenio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              <X className="w-3 h-3" />
              {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} activo{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
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
            <thead className="bg-slate-800/40 border-b border-slate-800/40 sticky top-0 z-20">
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">CURP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="inline-flex items-center">
                    Convenio
                    <ColumnFilterDropdown
                      label="Convenio"
                      options={filterOptions.convenio}
                      selected={columnFilters.convenio}
                      onApply={(v) => applyColumnFilter("convenio", v)}
                    />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="inline-flex items-center">
                    Estado
                    <ColumnFilterDropdown
                      label="Estado"
                      options={filterOptions.estado}
                      selected={columnFilters.estado}
                      onApply={(v) => applyColumnFilter("estado", v)}
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500 text-sm">
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                clientes.map((c) => {
                  const isSelected = selected.has(c.id);
                  const nombre = `${c.nombres ?? ""} ${c.a_paterno ?? ""} ${c.a_materno ?? ""}`.trim() || "—";
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
                      <td className="px-4 py-3 text-slate-200">{nombre}</td>
                      <td className="px-4 py-3 text-slate-400">{c.curp ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{c.convenio ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{c.estado ?? "—"}</td>
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
            Solicitar Lote IEPPO
          </Button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PENSIONADOS Selector
// ═══════════════════════════════════════════════════════════════════════════════

interface PensionadoCliente {
  id: number;
  nombre: string | null;
  a_paterno: string | null;
  a_materno: string | null;
  curp: string | null;
  nss: string | null;
  zona: string | null;
  id_movimiento: string | null;
  imp_saldo_pendiente: string | null;
  fec_inicio_prestamo: string | null;
}

interface PensionadosFilterState {
  zona: string[];
  id_movimiento: string[];
}

interface PensionadosFilterOptions {
  zona: string[];
  id_movimiento: string[];
}

type PensionadosFilterKey = keyof PensionadosFilterState;

function PensionadosSelector({
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
  const [clientes, setClientes] = useState<PensionadoCliente[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [columnFilters, setColumnFilters] = useState<PensionadosFilterState>({
    zona: [],
    id_movimiento: [],
  });
  const [filterOptions, setFilterOptions] = useState<PensionadosFilterOptions>({
    zona: [],
    id_movimiento: [],
  });
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const limit = 25;

  // Fetch filter options once
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const res = await fetch("/api/promotor/calificacion/pensionados-disponibles/filtros");
        if (res.ok) {
          setFilterOptions(await res.json());
        }
      } catch {
        // silently fail
      }
    };
    fetchFilterOptions();
  }, []);

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
        if (columnFilters.zona.length > 0) params.set("filter_zona", columnFilters.zona.join(","));
        if (columnFilters.id_movimiento.length > 0) params.set("filter_id_movimiento", columnFilters.id_movimiento.join(","));
        if (fechaDesde) params.set("filter_fec_inicio_desde", fechaDesde);
        if (fechaHasta) params.set("filter_fec_inicio_hasta", fechaHasta);

        const res = await fetch(`/api/promotor/calificacion/pensionados-disponibles?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setClientes(data.clientes);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      } catch {
        if (!cancelled) toast("Error al cargar pensionados", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchClientes();
    return () => { cancelled = true; };
  }, [page, debouncedSearch, columnFilters, fechaDesde, fechaHasta, toast]);

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
        body: JSON.stringify({ tipo: "PENSIONADOS", cliente_ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Error al solicitar", "error");
        return;
      }
      toast(`Se asignaron ${data.cantidad} registros Pensionados`, "success");
      onRefresh();
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const applyColumnFilter = (key: PensionadosFilterKey, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [key]: values }));
    setPage(1);
  };

  const activeFilterCount =
    columnFilters.zona.length +
    columnFilters.id_movimiento.length +
    (fechaDesde || fechaHasta ? 1 : 0);

  const clearAllFilters = () => {
    setColumnFilters({ zona: [], id_movimiento: [] });
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
  };

  const applyFechaFilter = (desde: string, hasta: string) => {
    setFechaDesde(desde);
    setFechaHasta(hasta);
    setPage(1);
  };

  const pageIds = clientes.map((c) => c.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const maxSelectable = cupo?.disponible ?? 0;

  if (cupo && cupo.disponible <= 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-slate-400">
          No tienes un lote Pensionados activo. Tu cupo diario está agotado.
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
            placeholder="Buscar por nombre, CURP o NSS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              <X className="w-3 h-3" />
              {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} activo{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
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
            <thead className="bg-slate-800/40 border-b border-slate-800/40 sticky top-0 z-20">
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">CURP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">NSS</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="inline-flex items-center">
                    Zona
                    <ColumnFilterDropdown
                      label="Zona"
                      options={filterOptions.zona}
                      selected={columnFilters.zona}
                      onApply={(v) => applyColumnFilter("zona", v)}
                    />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="inline-flex items-center">
                    Movimiento
                    <ColumnFilterDropdown
                      label="Movimiento"
                      options={filterOptions.id_movimiento}
                      selected={columnFilters.id_movimiento}
                      onApply={(v) => applyColumnFilter("id_movimiento", v)}
                    />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="inline-flex items-center">
                    Fecha Inicio Préstamo
                    <DateRangeFilterDropdown
                      label="Fecha Inicio Préstamo"
                      desde={fechaDesde}
                      hasta={fechaHasta}
                      onApply={applyFechaFilter}
                    />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Pend.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 text-sm">
                    No se encontraron pensionados
                  </td>
                </tr>
              ) : (
                clientes.map((c) => {
                  const isSelected = selected.has(c.id);
                  const nombre = `${c.nombre ?? ""} ${c.a_paterno ?? ""} ${c.a_materno ?? ""}`.trim() || "—";
                  const saldo = c.imp_saldo_pendiente
                    ? `$${Number(c.imp_saldo_pendiente).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                    : "—";
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
                      <td className="px-4 py-3">
                        <button
                          className="text-amber-400 hover:underline text-left"
                          onClick={(e) => { e.stopPropagation(); setDetailId(c.id); }}
                        >
                          {nombre}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{c.curp ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{c.nss ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{c.zona ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{c.id_movimiento ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{formatFechaInicio(c.fec_inicio_prestamo)}</td>
                      <td className="px-4 py-3 text-slate-400">{saldo}</td>
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
            Solicitar Lote Pensionados
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      {detailId !== null && (
        <PensionadosDetailDialog
          clienteId={detailId}
          isSelected={selected.has(detailId)}
          onToggleSelect={() => toggleSelect(detailId)}
          onClose={() => setDetailId(null)}
          toast={toast}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pensionados Detail Dialog
// ═══════════════════════════════════════════════════════════════════════════════

interface PensionadoDetalle {
  id: number;
  id_sol_pr_financiero: number | null;
  id_inst_financiera: number | null;
  zona: string | null;
  nss: string | null;
  id_grupo_familiar: number | null;
  id_movimiento: string | null;
  curp: string | null;
  nombre: string | null;
  a_paterno: string | null;
  a_materno: string | null;
  num_clabe: string | null;
  imp_prestamo: string | null;
  num_meses: number | null;
  fec_alta: string | null;
  fec_modificacion: string | null;
  imp_mensual: string | null;
  fec_inicio_prestamo: string | null;
  fec_term_prestamo: string | null;
  imp_saldo_pendiente: string | null;
  num_tasa_int_anual: string | null;
  cat_prestamo: string | null;
  imp_real_prestamo: string | null;
  ind_carta_instruccion: string | null;
  tasa_efectiva: string | null;
  tasa_efec_redondeada: string | null;
}

const PENSIONADO_DETAIL_FIELDS: { key: keyof PensionadoDetalle; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "a_paterno", label: "Apellido Paterno" },
  { key: "a_materno", label: "Apellido Materno" },
  { key: "curp", label: "CURP" },
  { key: "nss", label: "NSS" },
  { key: "zona", label: "Zona" },
  { key: "imp_real_prestamo", label: "Imp. Real Préstamo" },
  { key: "imp_mensual", label: "Imp. Mensual" },
  { key: "cat_prestamo", label: "CAT Préstamo" },
  { key: "num_tasa_int_anual", label: "Tasa Int. Anual" },
  { key: "fec_inicio_prestamo", label: "Fecha Inicio Préstamo" },
];

function PensionadosDetailDialog({
  clienteId,
  isSelected,
  onToggleSelect,
  onClose,
  toast,
}: {
  clienteId: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClose: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [data, setData] = useState<PensionadoDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/promotor/calificacion/pensionados-disponibles/${clienteId}`);
        if (res.ok && !cancelled) {
          setData(await res.json());
        } else if (!cancelled) {
          toast("Error al cargar detalle del pensionado", "error");
          onClose();
        }
      } catch {
        if (!cancelled) {
          toast("Error de conexión", "error");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
  }, [clienteId, toast, onClose]);

  const formatValue = (key: string, val: unknown): string => {
    if (val === null || val === undefined || val === "") return "—";
    if (key === "fec_alta" || key === "fec_modificacion") {
      try {
        return new Date(String(val)).toLocaleDateString("es-MX");
      } catch {
        return String(val);
      }
    }
    if (key === "imp_prestamo" || key === "imp_real_prestamo" || key === "imp_mensual" || key === "imp_saldo_pendiente") {
      const num = Number(val);
      if (!isNaN(num)) return `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
    }
    if (key === "num_tasa_int_anual" || key === "cat_prestamo" || key === "tasa_efectiva" || key === "tasa_efec_redondeada") {
      const num = Number(val);
      if (!isNaN(num)) return `${num}%`;
    }
    return String(val);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="lg">
      <DialogHeader onClose={onClose}>
        Detalle del Pensionado
      </DialogHeader>
      <DialogBody>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {PENSIONADO_DETAIL_FIELDS.map(({ key, label }) => (
              <div key={key} className="py-2 border-b border-slate-800/30">
                <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
                <p className="text-sm text-slate-200 mt-0.5 break-words">
                  {formatValue(key, data[key])}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        <Button
          variant={isSelected ? "ghost" : "primary"}
          onClick={() => { onToggleSelect(); onClose(); }}
        >
          {isSelected ? "Quitar selección" : "Seleccionar cliente"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CDMX Types + Selector
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

interface ColumnFilterState {
  institucion: string[];
  puesto: string[];
  servicio: string[];
}

interface FilterOptions {
  institucion: string[];
  puesto: string[];
  servicio: string[];
}

type FilterKey = keyof ColumnFilterState;

function formatFechaInicio(val: string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("es-MX");
}

function DateRangeFilterDropdown({
  label,
  desde,
  hasta,
  onApply,
}: {
  label: string;
  desde: string;
  hasta: string;
  onApply: (desde: string, hasta: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localDesde, setLocalDesde] = useState(desde);
  const [localHasta, setLocalHasta] = useState(hasta);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalDesde(desde);
    setLocalHasta(hasta);
  }, [desde, hasta]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleApply = () => {
    onApply(localDesde, localHasta);
    setOpen(false);
  };

  const handleClear = () => {
    setLocalDesde("");
    setLocalHasta("");
    onApply("", "");
    setOpen(false);
  };

  const isActive = !!(desde || hasta);

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`ml-1 p-0.5 rounded transition-colors ${
          isActive
            ? "text-amber-400 bg-amber-500/20"
            : "text-slate-500 hover:text-slate-300"
        }`}
        title={`Filtrar ${label}`}
      >
        <Filter className="w-3 h-3" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 space-y-2">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Desde</label>
              <input
                type="date"
                value={localDesde}
                onChange={(e) => setLocalDesde(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-200 outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Hasta</label>
              <input
                type="date"
                value={localHasta}
                onChange={(e) => setLocalHasta(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-200 outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
          <div className="p-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              onClick={handleClear}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Limpiar
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1 text-xs font-medium bg-amber-500 text-slate-900 rounded hover:bg-amber-400 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnFilterDropdown({
  label,
  options,
  selected,
  onApply,
}: {
  label: string;
  options: string[];
  selected: string[];
  onApply: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selected));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync local state when selected changes externally
  useEffect(() => {
    setLocalSelected(new Set(selected));
  }, [selected]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = filterSearch
    ? options.filter((o) => o.toLowerCase().includes(filterSearch.toLowerCase()))
    : options;

  const toggleValue = (val: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  const handleApply = () => {
    onApply(Array.from(localSelected));
    setOpen(false);
  };

  const handleClear = () => {
    setLocalSelected(new Set());
    onApply([]);
    setOpen(false);
  };

  const isActive = selected.length > 0;

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
          setFilterSearch("");
        }}
        className={`ml-1 p-0.5 rounded transition-colors ${
          isActive
            ? "text-amber-400 bg-amber-500/20"
            : "text-slate-500 hover:text-slate-300"
        }`}
        title={`Filtrar ${label}`}
      >
        <Filter className="w-3 h-3" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search within filter */}
          <div className="p-2 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-200 placeholder:text-slate-500 outline-none focus:border-amber-500/50"
                autoFocus
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">
                Sin resultados
              </div>
            ) : (
              filtered.map((opt) => {
                const isChecked = localSelected.has(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/50 cursor-pointer text-xs"
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                        isChecked
                          ? "bg-amber-500 border-amber-500"
                          : "border-slate-600 bg-slate-800/50"
                      }`}
                    >
                      {isChecked && <Check className="w-2.5 h-2.5 text-slate-900" />}
                    </div>
                    <span className="text-slate-300 truncate" title={opt}>
                      {opt}
                    </span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleValue(opt)}
                      className="sr-only"
                    />
                  </label>
                );
              })
            )}
          </div>

          {/* Actions */}
          <div className="p-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              onClick={handleClear}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Limpiar
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">
                {localSelected.size} de {options.length}
              </span>
              <button
                onClick={handleApply}
                className="px-3 py-1 text-xs font-medium bg-amber-500 text-slate-900 rounded hover:bg-amber-400 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  const [detailId, setDetailId] = useState<number | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState>({
    institucion: [],
    puesto: [],
    servicio: [],
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    institucion: [],
    puesto: [],
    servicio: [],
  });
  const limit = 25;

  // Fetch filter options once
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const res = await fetch("/api/promotor/calificacion/cdmx-disponibles/filtros");
        if (res.ok) {
          const data = await res.json();
          setFilterOptions(data);
        }
      } catch {
        // silently fail — filters will just be empty
      }
    };
    fetchFilterOptions();
  }, []);

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
        if (columnFilters.institucion.length > 0) params.set("filter_institucion", columnFilters.institucion.join(","));
        if (columnFilters.puesto.length > 0) params.set("filter_puesto", columnFilters.puesto.join(","));
        if (columnFilters.servicio.length > 0) params.set("filter_servicio", columnFilters.servicio.join(","));

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
  }, [page, debouncedSearch, columnFilters, toast]);

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

  const applyColumnFilter = (key: FilterKey, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [key]: values }));
    setPage(1);
  };

  const activeFilterCount = columnFilters.institucion.length + columnFilters.puesto.length + columnFilters.servicio.length;

  const clearAllFilters = () => {
    setColumnFilters({ institucion: [], puesto: [], servicio: [] });
    setPage(1);
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
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              <X className="w-3 h-3" />
              {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} activo{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
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
            <thead className="bg-slate-800/40 border-b border-slate-800/40 sticky top-0 z-20">
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="inline-flex items-center">
                    Institución
                    <ColumnFilterDropdown
                      label="Institución"
                      options={filterOptions.institucion}
                      selected={columnFilters.institucion}
                      onApply={(v) => applyColumnFilter("institucion", v)}
                    />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="inline-flex items-center">
                    Puesto
                    <ColumnFilterDropdown
                      label="Puesto"
                      options={filterOptions.puesto}
                      selected={columnFilters.puesto}
                      onApply={(v) => applyColumnFilter("puesto", v)}
                    />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="inline-flex items-center">
                    Servicio
                    <ColumnFilterDropdown
                      label="Servicio"
                      options={filterOptions.servicio}
                      selected={columnFilters.servicio}
                      onApply={(v) => applyColumnFilter("servicio", v)}
                    />
                  </span>
                </th>
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
                      <td className="px-4 py-3">
                        <button
                          className="text-amber-400 hover:underline text-left"
                          onClick={(e) => { e.stopPropagation(); setDetailId(c.id); }}
                        >
                          {c.nombre ?? "—"}
                        </button>
                      </td>
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

      {/* Detail dialog */}
      {detailId !== null && (
        <CdmxDetailDialog
          clienteId={detailId}
          isSelected={selected.has(detailId)}
          onToggleSelect={() => toggleSelect(detailId)}
          onClose={() => setDetailId(null)}
          toast={toast}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CDMX Detail Dialog
// ═══════════════════════════════════════════════════════════════════════════════

interface CdmxClienteDetalle {
  id: number;
  nombre: string | null;
  rfc: string | null;
  nomina: string | null;
  institucion: string | null;
  numero_empleado: number | null;
  puesto: string | null;
  contrato: number | null;
  cod_institucion: string | null;
  fecha: string | null;
  servicio: string | null;
  clave_descuento: string | null;
  cuotas_original: number | null;
  cuotas: number | null;
  valor_original: string | null;
  valor_enviado: string | null;
  valor_descontado: string | null;
  critica_envio: string | null;
  regreso: string | null;
  periodo_bloqueo: string | null;
  ultimo_periodo: number | null;
  procesamiento: string | null;
  descentralizado: string | null;
  cambio_manual: string | null;
  fecha_ingreso: string | null;
  eventos: string | null;
}

function formatCdmxValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (key === "fecha" || key === "procesamiento" || key === "fecha_ingreso") {
    try {
      return new Date(String(val)).toLocaleDateString("es-MX");
    } catch {
      return String(val);
    }
  }
  if (key === "valor_original" || key === "valor_enviado" || key === "valor_descontado") {
    const num = Number(val);
    if (!isNaN(num)) return `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
  }
  return String(val);
}

function formatIeppoValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

function formatPensionadoValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (key === "fec_alta" || key === "fec_modificacion" || key === "fec_inicio_prestamo" || key === "fec_term_prestamo") {
    try {
      return new Date(String(val)).toLocaleDateString("es-MX");
    } catch {
      return String(val);
    }
  }
  if (key === "imp_prestamo" || key === "imp_real_prestamo" || key === "imp_mensual" || key === "imp_saldo_pendiente") {
    const num = Number(val);
    if (!isNaN(num)) return `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
  }
  if (key === "num_tasa_int_anual" || key === "cat_prestamo" || key === "tasa_efectiva" || key === "tasa_efec_redondeada") {
    const num = Number(val);
    if (!isNaN(num)) return `${num}%`;
  }
  return String(val);
}

const PENSIONADO_CALIFICAR_FIELDS: { key: string; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "a_paterno", label: "Apellido Paterno" },
  { key: "a_materno", label: "Apellido Materno" },
  { key: "curp", label: "CURP" },
  { key: "nss", label: "NSS" },
  { key: "zona", label: "Zona" },
  { key: "imp_real_prestamo", label: "Imp. Real Préstamo" },
  { key: "imp_mensual", label: "Imp. Mensual" },
  { key: "cat_prestamo", label: "CAT Préstamo" },
  { key: "num_tasa_int_anual", label: "Tasa Int. Anual" },
  { key: "fec_inicio_prestamo", label: "Fecha Inicio Préstamo" },
];

const IEPPO_DETAIL_FIELDS: { key: string; label: string }[] = [
  { key: "nombres", label: "Nombres" },
  { key: "curp", label: "CURP" },
  { key: "filiacion", label: "Filiación" },
  { key: "clave_cct", label: "Clave CCT" },
  { key: "percepciones_fijas", label: "Percepciones Fijas" },
  { key: "capacidad", label: "Capacidad Original" },
  { key: "descuentos_terceros", label: "Descuentos Terceros" },
];

const DETAIL_FIELDS: { key: keyof CdmxClienteDetalle; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "rfc", label: "RFC" },
  { key: "nomina", label: "Nómina" },
  { key: "institucion", label: "Institución" },
  { key: "numero_empleado", label: "No. Empleado" },
  { key: "puesto", label: "Puesto" },
  { key: "contrato", label: "Contrato" },
  { key: "cod_institucion", label: "Cód. Institución" },
  { key: "servicio", label: "Servicio" },
  { key: "clave_descuento", label: "Clave Descuento" },
  { key: "cuotas_original", label: "Cuotas Original" },
  { key: "cuotas", label: "Cuotas" },
  { key: "valor_original", label: "Valor Original" },
  { key: "valor_enviado", label: "Valor Enviado" },
  { key: "valor_descontado", label: "Valor Descontado" },
  { key: "critica_envio", label: "Crítica Envío" },
  { key: "regreso", label: "Regreso" },
  { key: "periodo_bloqueo", label: "Periodo Bloqueo" },
  { key: "ultimo_periodo", label: "Último Periodo" },
  { key: "fecha", label: "Fecha" },
  { key: "procesamiento", label: "Procesamiento" },
  { key: "fecha_ingreso", label: "Fecha Ingreso" },
  { key: "descentralizado", label: "Descentralizado" },
  { key: "cambio_manual", label: "Cambio Manual" },
  { key: "eventos", label: "Eventos" },
];

function CdmxDetailDialog({
  clienteId,
  isSelected,
  onToggleSelect,
  onClose,
  toast,
}: {
  clienteId: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClose: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [data, setData] = useState<CdmxClienteDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/promotor/calificacion/cdmx-disponibles/${clienteId}`);
        if (res.ok && !cancelled) {
          setData(await res.json());
        } else if (!cancelled) {
          toast("Error al cargar detalle del cliente", "error");
          onClose();
        }
      } catch {
        if (!cancelled) {
          toast("Error de conexión", "error");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
  }, [clienteId, toast, onClose]);

  return (
    <Dialog open onClose={onClose} maxWidth="lg">
      <DialogHeader onClose={onClose}>
        Detalle del Cliente CDMX
      </DialogHeader>
      <DialogBody>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {DETAIL_FIELDS.map(({ key, label }) => (
              <div key={key} className="py-2 border-b border-slate-800/30">
                <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
                <p className="text-sm text-slate-200 mt-0.5 break-words">
                  {formatCdmxValue(key, data[key])}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        <Button
          variant={isSelected ? "ghost" : "primary"}
          onClick={() => { onToggleSelect(); onClose(); }}
        >
          {isSelected ? "Quitar selección" : "Seleccionar cliente"}
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
