"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowLeftRight, Download, Clock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromotorCupo {
  id: number;
  nombre: string;
  cupoRestante: number;
  cupoMaximo: number;
  oportunidadesActivas: number;
}

interface Opciones {
  tiposCliente: string[];
  convenios: string[];
  estados: string[];
  municipios: string[];
  disponibles: number;
  cupoRestante: number;
  cupoMaximo: number;
  asignables: number;
}

interface OportunidadEquipo {
  id: number;
  cliente_id: number;
  nombres: string;
  convenio: string;
  etapa: { id: number; nombre: string; color: string; tipo: string } | null;
  promotor: { id: number; nombre: string };
  timer_vence: string | null;
}

interface Promotor {
  id: number;
  nombre: string;
  total_activas: number;
}

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

function getEtapaBadgeColor(hex: string) {
  return etapaColorMap[hex?.toLowerCase()] ?? "slate";
}

function timerLabel(timer_vence: string | null) {
  if (!timer_vence) return "Sin timer";
  const diff = new Date(timer_vence).getTime() - Date.now();
  if (diff <= 0) return "Vencido";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SupervisorAsignacionesPage() {
  const [tab, setTab] = useState("solicitar");
  const { toast } = useToast();

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-slate-100 mb-6">Solicitar Datos / Reasignar</h1>

      <Tabs
        tabs={[
          { id: "solicitar", label: "Solicitar Datos" },
          { id: "reasignar", label: "Reasignar" },
        ]}
        activeTab={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === "solicitar" && <SolicitarTab toast={toast} />}
      {tab === "reasignar" && <ReasignarTab toast={toast} />}
    </div>
  );
}

// ─── Tab: Solicitar Datos ─────────────────────────────────────────────────────

function SolicitarTab({ toast }: { toast: (m: string, t?: "success" | "error" | "info" | "warning") => void }) {
  const [promotores, setPromotores] = useState<PromotorCupo[]>([]);
  const [loadingPromotores, setLoadingPromotores] = useState(true);
  const [selectedPromotor, setSelectedPromotor] = useState("");
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [loadingOpciones, setLoadingOpciones] = useState(false);
  const [tipoCliente, setTipoCliente] = useState("");
  const [convenio, setConvenio] = useState("");
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [tieneTelefono, setTieneTelefono] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch promotores
  const fetchPromotores = useCallback(async () => {
    try {
      const res = await fetch("/api/supervisor/asignaciones");
      if (res.ok) {
        const data = await res.json();
        setPromotores(data.promotores);
      }
    } catch { /* ignore */ }
    setLoadingPromotores(false);
  }, []);

  useEffect(() => { fetchPromotores(); }, [fetchPromotores]);

  // Fetch opciones when filters change
  const fetchOpciones = useCallback(async () => {
    if (!selectedPromotor) {
      setOpciones(null);
      return;
    }
    setLoadingOpciones(true);
    try {
      const params = new URLSearchParams({ promotor_id: selectedPromotor });
      if (tipoCliente) params.set("tipo_cliente", tipoCliente);
      if (convenio) params.set("convenio", convenio);
      if (estado) params.set("estado", estado);
      if (municipio) params.set("municipio", municipio);
      if (tieneTelefono) params.set("tiene_telefono", "true");
      const res = await fetch(`/api/supervisor/asignaciones/opciones?${params}`);
      if (res.ok) setOpciones(await res.json());
    } catch { /* ignore */ }
    setLoadingOpciones(false);
  }, [selectedPromotor, tipoCliente, convenio, estado, municipio, tieneTelefono]);

  useEffect(() => { fetchOpciones(); }, [fetchOpciones]);

  // Reset cascading filters
  const handleTipoClienteChange = (v: string) => {
    setTipoCliente(v);
    setConvenio("");
    setEstado("");
    setMunicipio("");
  };
  const handleConvenioChange = (v: string) => {
    setConvenio(v);
    setEstado("");
    setMunicipio("");
  };
  const handleEstadoChange = (v: string) => {
    setEstado(v);
    setMunicipio("");
  };
  const handlePromotorChange = (v: string) => {
    setSelectedPromotor(v);
    setTipoCliente("");
    setConvenio("");
    setEstado("");
    setMunicipio("");
    setCantidad("");
  };

  const handleAsignar = async () => {
    if (!selectedPromotor) return;
    const cant = cantidad ? parseInt(cantidad) : undefined;
    if (cant != null && (cant < 1 || !Number.isFinite(cant))) {
      toast("Cantidad invalida", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/supervisor/asignaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promotor_id: Number(selectedPromotor),
          cantidad: cant,
          tipo_cliente: tipoCliente || undefined,
          convenio: convenio || undefined,
          estado: estado || undefined,
          municipio: municipio || undefined,
          tiene_telefono: tieneTelefono || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast(`${data.cantidad} registros asignados. Cupo restante: ${data.cupo_restante}`, "success");
        fetchPromotores();
        fetchOpciones();
      } else {
        const err = await res.json();
        toast(err.error || "Error al asignar", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setSubmitting(false);
  };

  const selectedPromotorData = promotores.find((p) => String(p.id) === selectedPromotor);

  if (loadingPromotores) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div className="space-y-5">
      {/* Selector de promotor */}
      <div className="bg-surface rounded-xl border border-slate-800/60 p-5">
        <h2 className="text-sm font-semibold text-slate-100 mb-4">Seleccionar Promotor</h2>
        <Select
          label="Promotor"
          value={selectedPromotor}
          onChange={(e) => handlePromotorChange(e.target.value)}
          placeholder="Seleccionar promotor..."
          options={promotores.map((p) => ({
            value: String(p.id),
            label: `${p.nombre} — Cupo: ${p.cupoRestante}/${p.cupoMaximo} | Activas: ${p.oportunidadesActivas}`,
          }))}
        />

        {selectedPromotorData && (
          <div className="mt-3 flex gap-4">
            <div className="text-xs text-slate-400">
              Cupo restante: <span className={`font-bold ${selectedPromotorData.cupoRestante > 0 ? "text-green-400" : "text-red-400"}`}>
                {selectedPromotorData.cupoRestante}
              </span>
              /{selectedPromotorData.cupoMaximo}
            </div>
            <div className="text-xs text-slate-400">
              Oportunidades activas: <span className="font-bold text-slate-200">{selectedPromotorData.oportunidadesActivas}</span>
            </div>
          </div>
        )}
      </div>

      {/* Filtros cascada */}
      {selectedPromotor && (
        <div className="bg-surface rounded-xl border border-slate-800/60 p-5">
          <h2 className="text-sm font-semibold text-slate-100 mb-4">Filtros del Pool</h2>

          {loadingOpciones && !opciones ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select
                  label="Tipo Cliente"
                  value={tipoCliente}
                  onChange={(e) => handleTipoClienteChange(e.target.value)}
                  placeholder="Todos"
                  options={(opciones?.tiposCliente || []).map((t) => ({ value: t, label: t }))}
                />
                <Select
                  label="Convenio"
                  value={convenio}
                  onChange={(e) => handleConvenioChange(e.target.value)}
                  placeholder="Todos"
                  options={(opciones?.convenios || []).map((c) => ({ value: c, label: c }))}
                />
                <Select
                  label="Estado"
                  value={estado}
                  onChange={(e) => handleEstadoChange(e.target.value)}
                  placeholder="Todos"
                  options={(opciones?.estados || []).map((e) => ({ value: e, label: e }))}
                />
                <Select
                  label="Municipio"
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  placeholder="Todos"
                  options={(opciones?.municipios || []).map((m) => ({ value: m, label: m }))}
                  disabled={!estado}
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tieneTelefono}
                    onChange={(e) => setTieneTelefono(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/40"
                  />
                  Solo con telefono
                </label>
              </div>

              <div className="h-px bg-slate-800/60" />

              <div className="flex items-end gap-4">
                <div className="w-[140px]">
                  <Input
                    label="Cantidad"
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder={opciones ? String(opciones.asignables) : ""}
                    min={1}
                    max={opciones?.asignables}
                  />
                </div>

                <div className="flex items-center gap-3">
                  {opciones && (
                    <span className="text-xs text-slate-400">
                      Disponibles: <span className="font-bold text-slate-200">{opciones.disponibles.toLocaleString()}</span>
                      {" | "}Asignables: <span className="font-bold text-green-400">{opciones.asignables.toLocaleString()}</span>
                    </span>
                  )}
                </div>

                <Button
                  variant="primary"
                  icon={<Download className="w-4 h-4" />}
                  loading={submitting}
                  disabled={!selectedPromotor || submitting || (opciones?.asignables ?? 0) === 0}
                  onClick={handleAsignar}
                >
                  Asignar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Reasignar ───────────────────────────────────────────────────────────

function ReasignarTab({ toast }: { toast: (m: string, t?: "success" | "error" | "info" | "warning") => void }) {
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
