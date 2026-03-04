"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { LinearProgress } from "@/components/ui/LinearProgress";
import { ClipboardList } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

export default function SolicitarAsignacionDialog({ open, onClose, onSuccess }: Props) {
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [filtros, setFiltros] = useState({
    tipo_cliente: "",
    convenio: "",
    estado: "",
    municipio: "",
    rango_oferta: "",
    tiene_telefono: false,
  });
  const [cantidad, setCantidad] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchOpciones = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.tipo_cliente) params.set("tipo_cliente", filtros.tipo_cliente);
      if (filtros.convenio) params.set("convenio", filtros.convenio);
      if (filtros.estado) params.set("estado", filtros.estado);
      if (filtros.municipio) params.set("municipio", filtros.municipio);
      if (filtros.rango_oferta) params.set("rango_oferta", filtros.rango_oferta);
      if (filtros.tiene_telefono) params.set("tiene_telefono", "true");

      const res = await fetch(`/api/asignaciones/opciones?${params}`, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setOpciones(data);
        setCantidad(Math.min(data.asignables, 20));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError("Error al cargar opciones de asignacion");
      }
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    if (open) fetchOpciones();
    return () => abortRef.current?.abort();
  }, [open, fetchOpciones]);

  const handleClose = () => {
    setFiltros({ tipo_cliente: "", convenio: "", estado: "", municipio: "", rango_oferta: "", tiene_telefono: false });
    setCantidad(0);
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/asignaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cantidad,
          ...filtros,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al solicitar asignacion");
        return;
      }

      handleClose();
      onSuccess();
    } catch {
      setError("Error de conexion");
    } finally {
      setSubmitting(false);
    }
  };

  const maxAsignable = opciones?.asignables ?? 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg">
      <DialogHeader onClose={handleClose}>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-amber-400" />
          <span>Solicitar Asignacion</span>
        </div>
      </DialogHeader>

      <DialogBody>
        <div className="flex flex-col gap-4 relative">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-xl">
              <Spinner size="md" />
            </div>
          )}
          {/* Counters */}
          {opciones && (
            <div className="flex gap-2 justify-center">
              <div className="text-center flex-1 px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-lg font-bold text-blue-400">
                  {opciones.disponibles.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-400">En pool</p>
              </div>
              <div className={`text-center flex-1 px-3 py-2 rounded-lg border ${
                opciones.cupoRestante > 0
                  ? "bg-green-500/10 border-green-500/20"
                  : "bg-red-500/10 border-red-500/20"
              }`}>
                <p className={`text-lg font-bold ${opciones.cupoRestante > 0 ? "text-green-400" : "text-red-400"}`}>
                  {opciones.cupoRestante.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-400">Cupo hoy</p>
              </div>
            </div>
          )}

          {opciones && opciones.cupoRestante > 0 && (
            <LinearProgress
              value={(opciones.cupoMaximo - opciones.cupoRestante)}
              max={opciones.cupoMaximo}
              color="amber"
            />
          )}

          <div className="h-px bg-slate-800/40" />

          {/* Cascade filters */}
          <Select
            label="Tipo de cliente"
            value={filtros.tipo_cliente}
            onChange={(e) => setFiltros((p) => ({ ...p, tipo_cliente: e.target.value, convenio: "", estado: "", municipio: "" }))}
            options={(opciones?.tiposCliente ?? []).map((v) => ({ value: v, label: v }))}
            placeholder="Todos"
          />

          <Select
            label="Convenio"
            value={filtros.convenio}
            onChange={(e) => setFiltros((p) => ({ ...p, convenio: e.target.value, estado: "", municipio: "" }))}
            options={(opciones?.convenios ?? []).map((v) => ({ value: v, label: v }))}
            placeholder="Todos"
          />

          <Select
            label="Estado"
            value={filtros.estado}
            onChange={(e) => setFiltros((p) => ({ ...p, estado: e.target.value, municipio: "" }))}
            options={(opciones?.estados ?? []).map((v) => ({ value: v, label: v }))}
            placeholder="Todos"
          />

          <Select
            label="Municipio"
            value={filtros.municipio}
            onChange={(e) => setFiltros((p) => ({ ...p, municipio: e.target.value }))}
            options={(opciones?.municipios ?? []).map((v) => ({ value: v, label: v }))}
            placeholder="Todos"
            disabled={!filtros.estado}
          />

          <Select
            label="Rango de oferta"
            value={filtros.rango_oferta}
            onChange={(e) => setFiltros((p) => ({ ...p, rango_oferta: e.target.value }))}
            options={[
              { value: "0-50000", label: "$0 - $50,000" },
              { value: "50000-100000", label: "$50,000 - $100,000" },
              { value: "100000-500000", label: "$100,000 - $500,000" },
              { value: "500000+", label: "$500,000+" },
            ]}
            placeholder="Todos"
          />

          {/* Toggle - solo registros con telefono */}
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={filtros.tiene_telefono}
                onChange={(e) => setFiltros((p) => ({ ...p, tiene_telefono: e.target.checked }))}
              />
              <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-500 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-sm text-slate-300">Solo registros con telefono</span>
          </label>

          <div className="h-px bg-slate-800/40" />

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Cantidad a solicitar</label>
            <input
              type="number"
              value={cantidad || ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") { setCantidad(0); return; }
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 0 && num <= 300) setCantidad(num);
              }}
              placeholder="1 - 300"
              disabled={maxAsignable === 0}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-200 placeholder-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 outline-none transition-all disabled:opacity-50"
            />
            {cantidad > maxAsignable && maxAsignable > 0 && (
              <p className="mt-1 text-xs text-amber-400">Solo hay {maxAsignable} disponibles con estos filtros</p>
            )}
          </div>

          {opciones && (
            <div className="text-center p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <p className="text-sm font-semibold text-purple-400">
                {opciones.asignables.toLocaleString()} asignables
                <span className="font-normal text-slate-400"> con los filtros seleccionados</span>
              </p>
            </div>
          )}
          {error && <Alert variant="error">{error}</Alert>}

          {opciones?.cupoRestante === 0 && (
            <Alert variant="warning">
              Has alcanzado tu limite diario de asignaciones. Se reinicia manana.
            </Alert>
          )}
        </div>
      </DialogBody>

      <DialogFooter>
        <Button variant="danger" onClick={handleClose}>Cancelar</Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={submitting || maxAsignable === 0 || cantidad <= 0 || cantidad > maxAsignable || (opciones?.cupoRestante ?? 0) === 0}
          loading={submitting}
          icon={!submitting ? <ClipboardList className="w-4 h-4" /> : undefined}
          className="font-bold px-6"
        >
          {submitting ? "Asignando..." : `Asignar ${cantidad}`}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
