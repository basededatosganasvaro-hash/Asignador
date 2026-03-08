"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import {
  Users, UserMinus, AlertTriangle, TrendingUp, ShoppingCart, Briefcase,
} from "lucide-react";

interface Promotor {
  id: number;
  nombre: string;
  username: string;
  activo: boolean;
  created_at: string;
  oportunidades_activas: number;
  lotes: number;
  ventas: number;
}

interface Equipo {
  id: number;
  nombre: string;
}

export default function PlantillaPage() {
  const { toast } = useToast();
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog baja
  const [bajaTarget, setBajaTarget] = useState<Promotor | null>(null);
  const [receptorId, setReceptorId] = useState("");
  const [bajaLoading, setBajaLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/supervisor/plantilla");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEquipo(data.equipo);
      setPromotores(data.promotores);
    } catch {
      toast("Error al cargar plantilla", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const promotoresActivos = promotores.filter((p) => p.activo);
  const promotoresInactivos = promotores.filter((p) => !p.activo);

  // Receptores posibles: promotores activos del equipo, excepto el que se va a dar de baja
  const receptores = promotoresActivos.filter((p) => p.id !== bajaTarget?.id);

  const handleBaja = async () => {
    if (!bajaTarget || !receptorId) return;

    setBajaLoading(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${bajaTarget.id}/baja`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receptor_id: Number(receptorId) }),
      });
      const data = await res.json();

      if (res.ok) {
        const receptor = receptores.find((r) => r.id === Number(receptorId));
        toast(
          `${bajaTarget.nombre} dado de baja. ${data.transferidas} oportunidad${data.transferidas !== 1 ? "es" : ""} transferida${data.transferidas !== 1 ? "s" : ""} a ${receptor?.nombre || "receptor"}`,
          "success"
        );
        setBajaTarget(null);
        setReceptorId("");
        fetchData();
      } else {
        toast(data.error || "Error al dar de baja", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setBajaLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
          <Users className="w-7 h-7 text-slate-950" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            Mi Plantilla
          </h1>
          <span className="text-sm text-slate-400">
            {equipo ? `Equipo: ${equipo.nombre}` : "Sin equipo asignado"}
            {" — "}
            {promotoresActivos.length} promotor{promotoresActivos.length !== 1 ? "es" : ""} activo{promotoresActivos.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {!equipo ? (
        <div className="bg-surface rounded-xl border border-slate-800/60 p-8 text-center">
          <p className="text-slate-400">No tienes un equipo asignado</p>
        </div>
      ) : promotores.length === 0 ? (
        <div className="bg-surface rounded-xl border border-slate-800/60 p-8 text-center">
          <p className="text-slate-400">No hay promotores en tu equipo</p>
        </div>
      ) : (
        <>
          {/* Promotores activos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {promotoresActivos.map((p) => (
              <div
                key={p.id}
                className="bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600" />

                {/* Avatar + nombre */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm font-semibold text-blue-300">
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{p.nombre}</p>
                    <p className="text-xs text-slate-500">@{p.username}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                    Activo
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-lg font-bold text-slate-100">{p.oportunidades_activas}</p>
                    <p className="text-[10px] text-slate-500">Oportunidades</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <Briefcase className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-lg font-bold text-slate-100">{p.lotes}</p>
                    <p className="text-[10px] text-slate-500">Lotes</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <ShoppingCart className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-lg font-bold text-slate-100">{p.ventas}</p>
                    <p className="text-[10px] text-slate-500">Ventas</p>
                  </div>
                </div>

                {/* Boton baja */}
                <Button
                  variant="danger"
                  size="sm"
                  icon={<UserMinus className="w-4 h-4" />}
                  onClick={() => {
                    setBajaTarget(p);
                    setReceptorId("");
                  }}
                  className="w-full"
                >
                  Dar de baja
                </Button>
              </div>
            ))}
          </div>

          {/* Promotores inactivos */}
          {promotoresInactivos.length > 0 && (
            <>
              <div className="h-px bg-slate-800/50 my-6" />
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Inactivos ({promotoresInactivos.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {promotoresInactivos.map((p) => (
                  <div
                    key={p.id}
                    className="bg-surface rounded-xl border border-slate-800/60 p-5 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700/30 border border-slate-700/40 flex items-center justify-center text-sm font-semibold text-slate-500">
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-400 truncate">{p.nombre}</p>
                        <p className="text-xs text-slate-600">@{p.username}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                        Inactivo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Dialog confirmar baja */}
      <Dialog open={!!bajaTarget} onClose={() => setBajaTarget(null)} maxWidth="md">
        <DialogHeader onClose={() => setBajaTarget(null)}>
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>Dar de baja a {bajaTarget?.nombre}</span>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-4">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300">
                Esta accion desactivara al promotor y transferira sus{" "}
                <strong>{bajaTarget?.oportunidades_activas} oportunidad{bajaTarget?.oportunidades_activas !== 1 ? "es" : ""} activa{bajaTarget?.oportunidades_activas !== 1 ? "s" : ""}</strong>{" "}
                al promotor receptor que selecciones.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Transferir oportunidades a:
              </label>
              {receptores.length === 0 ? (
                <p className="text-sm text-red-400">No hay otros promotores activos para recibir las oportunidades</p>
              ) : (
                <select
                  value={receptorId}
                  onChange={(e) => setReceptorId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60 outline-none transition-all"
                >
                  <option value="">Selecciona un promotor...</option>
                  {receptores.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} (@{r.username}) — {r.oportunidades_activas} opp. activas
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setBajaTarget(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<UserMinus className="w-4 h-4" />}
            loading={bajaLoading}
            disabled={!receptorId || receptores.length === 0}
            onClick={handleBaja}
          >
            Confirmar baja
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
