"use client";
import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, ArrowLeftRight, UserX, Clock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OportunidadBandeja {
  id: number;
  cliente_id: number;
  nombres: string;
  convenio: string;
  etapa: { id: number; nombre: string; color: string; tipo: string } | null;
  promotor: { id: number; nombre: string };
  timer_vence: string | null;
  updated_at: string;
}

interface OportunidadDetalle {
  id: number;
  cliente_id: number;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  activo: boolean;
  cliente: Record<string, string | null>;
  transiciones: {
    id: number;
    nombre_accion: string;
    requiere_nota: boolean;
    requiere_supervisor: boolean;
    devuelve_al_pool: boolean;
    etapa_destino: { id: number; nombre: string; color: string; tipo: string } | null;
  }[];
}

interface Promotor {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
  total_activas: number;
  en_salida: number;
  en_avance: number;
}

interface OportunidadEquipo extends OportunidadBandeja {}

// ─── Etapa color mapping ─────────────────────────────────────────────────────

const etapaColorMap: Record<string, "amber" | "green" | "red" | "blue" | "purple" | "yellow" | "teal" | "orange" | "slate" | "emerald"> = {
  "#ff9800": "orange",
  "#f44336": "red",
  "#4caf50": "green",
  "#2196f3": "blue",
  "#9c27b0": "purple",
  "#ffeb3b": "yellow",
  "#009688": "teal",
  "#ff5722": "orange",
  "#607080": "slate",
  "#4caf4f": "emerald",
};

function getEtapaBadgeColor(hex: string): "amber" | "green" | "red" | "blue" | "purple" | "yellow" | "teal" | "orange" | "slate" | "emerald" {
  return etapaColorMap[hex?.toLowerCase()] ?? "slate";
}

// ─── Timer label ──────────────────────────────────────────────────────────────

function timerLabel(timer_vence: string | null) {
  if (!timer_vence) return "Sin timer";
  const diff = new Date(timer_vence).getTime() - Date.now();
  if (diff <= 0) return "Vencido";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupervisorBandejaPage() {
  const [tab, setTab] = useState("salida");
  const { toast } = useToast();

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-slate-100 mb-6">Bandeja del Supervisor</h1>

      <Tabs
        tabs={[
          { id: "salida", label: "En Salida" },
          { id: "equipo", label: "Mi Equipo" },
          { id: "promotores", label: "Promotores" },
        ]}
        activeTab={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === "salida" && <BandejaTab toast={toast} />}
      {tab === "equipo" && <EquipoTab toast={toast} />}
      {tab === "promotores" && <PromotoresTab toast={toast} />}
    </div>
  );
}

// ─── Tab 1: Bandeja SALIDA ────────────────────────────────────────────────────

function BandejaTab({ toast }: { toast: (m: string, t?: "success" | "error" | "info" | "warning") => void }) {
  const [rows, setRows] = useState<OportunidadBandeja[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OportunidadDetalle | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nota, setNota] = useState("");
  const [canal, setCanal] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bandeja");
      if (!res.ok) throw new Error("Error al cargar bandeja");
      setRows(await res.json());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenDrawer = async (id: number) => {
    try {
      const res = await fetch(`/api/oportunidades/${id}`);
      if (res.ok) {
        setSelected(await res.json());
        setNota("");
        setCanal("");
        setDrawerOpen(true);
      }
    } catch {
      toast("Error al cargar oportunidad", "error");
    }
  };

  const handleTransicion = async (transicionId: number, requiereNota: boolean) => {
    if (requiereNota && !nota.trim()) {
      toast("Esta transicion requiere una nota", "error");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/oportunidades/${selected!.id}/transicion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transicion_id: transicionId, nota: nota || undefined, canal: canal || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      setDrawerOpen(false);
      toast("Accion ejecutada", "success");
      fetchData();
    } else {
      const err = await res.json();
      toast(err.error || "Error", "error");
    }
  };

  const columns: ColumnDef<OportunidadBandeja>[] = [
    {
      accessorKey: "nombres",
      header: "Cliente",
      size: 200,
      cell: ({ row }) => <span className="text-sm text-slate-200">{row.original.nombres}</span>,
    },
    {
      accessorKey: "convenio",
      header: "Convenio",
      size: 160,
      cell: ({ row }) => <span className="text-sm text-slate-300">{row.original.convenio}</span>,
    },
    {
      accessorKey: "etapa",
      header: "Etapa",
      size: 150,
      cell: ({ row }) =>
        row.original.etapa ? (
          <Badge color={getEtapaBadgeColor(row.original.etapa.color)}>{row.original.etapa.nombre}</Badge>
        ) : (
          <span className="text-sm text-slate-500">&mdash;</span>
        ),
    },
    {
      accessorKey: "promotor",
      header: "Promotor",
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm text-slate-300">{row.original.promotor?.nombre ?? "\u2014"}</span>
      ),
    },
    {
      accessorKey: "timer_vence",
      header: "Timer",
      size: 110,
      cell: ({ row }) => {
        const label = timerLabel(row.original.timer_vence);
        const isExpired = label === "Vencido";
        return (
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3.5 h-3.5 ${isExpired ? "text-red-400" : "text-slate-500"}`} />
            <span className={`text-sm ${isExpired ? "text-red-400 font-medium" : "text-slate-400"}`}>
              {label}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Acciones",
      size: 90,
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<Eye className="w-4 h-4" />}
          onClick={() => handleOpenDrawer(row.original.id)}
          title="Ver y actuar"
        />
      ),
    },
  ];

  return (
    <>
      {rows.length === 0 && !loading && (
        <Alert variant="info" className="mb-4">No hay oportunidades en etapas de salida.</Alert>
      )}

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        pageSize={25}
        pageSizeOptions={[25]}
        emptyMessage="No hay oportunidades en etapas de salida"
      />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={selected ? `Oportunidad #${selected.id}` : ""} width="w-[420px]">
        {selected && (
          <div className="flex flex-col gap-4">
            {selected.etapa && (
              <Badge color={getEtapaBadgeColor(selected.etapa.color)} className="self-start">
                {selected.etapa.nombre}
              </Badge>
            )}

            <Card>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos del cliente</span>
              <p className="text-sm text-slate-200 mt-1">
                {(selected.cliente as { nombres?: string }).nombres ?? "\u2014"}
              </p>
              <span className="text-sm text-slate-400">
                {(selected.cliente as { convenio?: string }).convenio ?? "\u2014"}
              </span>
            </Card>

            <Select
              label="Canal"
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              options={[
                { value: "", label: "Sin canal" },
                { value: "LLAMADA", label: "Llamada" },
                { value: "WHATSAPP", label: "WhatsApp" },
                { value: "SMS", label: "SMS" },
              ]}
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nota</label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-200 placeholder-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 outline-none transition-all resize-none"
                placeholder="Escribe una nota..."
              />
            </div>

            <h2 className="text-sm font-semibold text-slate-300">Acciones disponibles</h2>

            {selected.transiciones.length === 0 && (
              <Alert variant="info">Sin acciones disponibles.</Alert>
            )}

            <div className="flex flex-col gap-2">
              {selected.transiciones.map((t) => {
                const variant = t.devuelve_al_pool ? "danger" : "outline";
                const outlineColor = !t.devuelve_al_pool
                  ? t.etapa_destino?.tipo === "AVANCE"
                    ? "green"
                    : undefined
                  : undefined;

                return (
                  <Button
                    key={t.id}
                    variant={variant}
                    fullWidth
                    disabled={saving}
                    onClick={() => handleTransicion(t.id, t.requiere_nota)}
                    outlineColor={outlineColor}
                    className="justify-between"
                  >
                    <span>{t.nombre_accion}</span>
                    {t.etapa_destino && (
                      <Badge color={getEtapaBadgeColor(t.etapa_destino.color)}>
                        {t.etapa_destino.nombre}
                      </Badge>
                    )}
                    {t.devuelve_al_pool && (
                      <Badge color="slate">Pool</Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

// ─── Tab 2: Mi Equipo (todas las oportunidades) ───────────────────────────────

function EquipoTab({ toast }: { toast: (m: string, t?: "success" | "error" | "info" | "warning") => void }) {
  const [rows, setRows] = useState<OportunidadEquipo[]>([]);
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasignarOp, setReasignarOp] = useState<OportunidadEquipo | null>(null);
  const [nuevoPromotor, setNuevoPromotor] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [opRes, prRes] = await Promise.all([
        fetch("/api/admin/equipo/oportunidades"),
        fetch("/api/admin/equipo"),
      ]);
      setRows(await opRes.json());
      setPromotores(await prRes.json());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReasignar = async () => {
    if (!reasignarOp || !nuevoPromotor) return;
    const res = await fetch(`/api/admin/oportunidades/${reasignarOp.id}/reasignar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nuevo_usuario_id: Number(nuevoPromotor) }),
    });
    if (res.ok) {
      setReasignarOp(null);
      setNuevoPromotor("");
      toast("Oportunidad reasignada", "success");
      fetchData();
    } else {
      const err = await res.json();
      toast(err.error || "Error", "error");
    }
  };

  const columns: ColumnDef<OportunidadEquipo>[] = [
    {
      accessorKey: "nombres",
      header: "Cliente",
      size: 200,
      cell: ({ row }) => <span className="text-sm text-slate-200">{row.original.nombres}</span>,
    },
    {
      accessorKey: "convenio",
      header: "Convenio",
      size: 160,
      cell: ({ row }) => <span className="text-sm text-slate-300">{row.original.convenio}</span>,
    },
    {
      accessorKey: "etapa",
      header: "Etapa",
      size: 140,
      cell: ({ row }) =>
        row.original.etapa ? (
          <Badge color={getEtapaBadgeColor(row.original.etapa.color)}>{row.original.etapa.nombre}</Badge>
        ) : (
          <span className="text-sm text-slate-500">&mdash;</span>
        ),
    },
    {
      accessorKey: "promotor",
      header: "Promotor",
      size: 140,
      cell: ({ row }) => (
        <span className="text-sm text-slate-300">{row.original.promotor?.nombre ?? "\u2014"}</span>
      ),
    },
    {
      accessorKey: "timer_vence",
      header: "Timer",
      size: 110,
      cell: ({ row }) => {
        const label = timerLabel(row.original.timer_vence);
        const isExpired = label === "Vencido";
        return (
          <span className={`text-sm ${isExpired ? "text-red-400 font-medium" : "text-slate-400"}`}>
            {label}
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
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeftRight className="w-4 h-4" />}
          onClick={() => { setReasignarOp(row.original); setNuevoPromotor(""); }}
          title="Reasignar"
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        pageSize={25}
        pageSizeOptions={[25, 50]}
        emptyMessage="No hay oportunidades asignadas"
      />

      <Dialog open={!!reasignarOp} onClose={() => setReasignarOp(null)} maxWidth="sm">
        <DialogHeader onClose={() => setReasignarOp(null)}>Reasignar Oportunidad</DialogHeader>
        <DialogBody>
          <p className="text-sm text-slate-400 mb-4">
            Cliente: <strong className="text-slate-200">{reasignarOp?.nombres}</strong>
          </p>
          <Select
            label="Nuevo promotor"
            value={nuevoPromotor}
            onChange={(e) => setNuevoPromotor(e.target.value)}
            placeholder="Seleccionar promotor..."
            options={promotores
              .filter((p) => p.id !== reasignarOp?.promotor?.id)
              .map((p) => ({ value: String(p.id), label: `${p.nombre} (${p.total_activas} activas)` }))
            }
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setReasignarOp(null)}>Cancelar</Button>
          <Button variant="primary" onClick={handleReasignar} disabled={!nuevoPromotor}>Reasignar</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

// ─── Tab 3: Promotores ────────────────────────────────────────────────────────

function PromotoresTab({ toast }: { toast: (m: string, t?: "success" | "error" | "info" | "warning") => void }) {
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [loading, setLoading] = useState(true);
  const [bajaPromotor, setBajaPromotor] = useState<Promotor | null>(null);
  const [receptorId, setReceptorId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/equipo");
      if (!res.ok) throw new Error("Error al cargar promotores");
      setPromotores(await res.json());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBaja = async () => {
    if (!bajaPromotor) return;
    setSaving(true);
    const res = await fetch(`/api/admin/usuarios/${bajaPromotor.id}/baja`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receptor_id: receptorId ? Number(receptorId) : undefined }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setBajaPromotor(null);
      toast(`Promotor dado de baja. ${data.transferidas} oportunidades transferidas.`, "success");
      fetchData();
    } else {
      const err = await res.json();
      toast(err.error || "Error", "error");
    }
  };

  const columns: ColumnDef<Promotor>[] = [
    {
      accessorKey: "nombre",
      header: "Nombre",
      size: 200,
      cell: ({ row }) => <span className="text-sm text-slate-200">{row.original.nombre}</span>,
    },
    {
      accessorKey: "username",
      header: "Usuario",
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm text-slate-400 font-mono">
          {(row.original as Promotor & { username?: string }).username ?? "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "total_activas",
      header: "Activas",
      size: 90,
      cell: ({ row }) => (
        <span className="text-sm text-slate-300 text-center block">{row.original.total_activas}</span>
      ),
    },
    {
      accessorKey: "en_salida",
      header: "En Salida",
      size: 100,
      cell: ({ row }) =>
        row.original.en_salida > 0 ? (
          <Badge color="amber">{row.original.en_salida}</Badge>
        ) : (
          <span className="text-sm text-slate-500 text-center block">{row.original.en_salida}</span>
        ),
    },
    {
      accessorKey: "en_avance",
      header: "En Avance",
      size: 100,
      cell: ({ row }) => (
        <span className="text-sm text-slate-300 text-center block">{row.original.en_avance}</span>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      size: 140,
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="danger"
          size="sm"
          icon={<UserX className="w-4 h-4" />}
          onClick={() => { setBajaPromotor(row.original); setReceptorId(""); }}
        >
          Dar de baja
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={promotores}
        columns={columns}
        loading={loading}
        pageSize={10}
        pageSizeOptions={[10, 25]}
        emptyMessage="No hay promotores en el equipo"
      />

      <Dialog open={!!bajaPromotor} onClose={() => setBajaPromotor(null)} maxWidth="sm">
        <DialogHeader onClose={() => setBajaPromotor(null)}>
          Dar de Baja: {bajaPromotor?.nombre}
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-slate-400 mb-4">
            Este promotor tiene <strong className="text-slate-200">{bajaPromotor?.total_activas}</strong> oportunidades activas.
            Se transferiran al promotor seleccionado (o a ti si no seleccionas ninguno).
          </p>
          <Select
            label="Transferir oportunidades a (opcional)"
            value={receptorId}
            onChange={(e) => setReceptorId(e.target.value)}
            placeholder="A mi mismo"
            options={promotores
              .filter((p) => p.id !== bajaPromotor?.id)
              .map((p) => ({ value: String(p.id), label: p.nombre }))
            }
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setBajaPromotor(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleBaja} loading={saving}>
            Confirmar baja
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
