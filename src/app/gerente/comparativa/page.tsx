"use client";
import { useEffect, useState } from "react";

interface Unidad {
  id: number;
  nombre: string;
  supervisor?: string | null;
  promotores: number;
  oppActivas: number;
  ventasMes: number;
  montoMes: number;
  asignadosMes: number;
  conversion: number;
  interaccionesMes: number;
}

export default function ComparativaPage() {
  const [tipo, setTipo] = useState<"sucursales" | "equipos" | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gerente/comparativa")
      .then((r) => r.json())
      .then((data) => {
        setTipo(data.tipo);
        setUnidades(data.unidades ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  const label = tipo === "sucursales" ? "Sucursal" : "Equipo";
  const maxVentas = Math.max(...unidades.map((u) => u.ventasMes), 1);

  // Totales
  const totales = {
    promotores: unidades.reduce((s, u) => s + u.promotores, 0),
    oppActivas: unidades.reduce((s, u) => s + u.oppActivas, 0),
    ventasMes: unidades.reduce((s, u) => s + u.ventasMes, 0),
    montoMes: unidades.reduce((s, u) => s + u.montoMes, 0),
    asignadosMes: unidades.reduce((s, u) => s + u.asignadosMes, 0),
    interaccionesMes: unidades.reduce((s, u) => s + u.interaccionesMes, 0),
  };
  const totalConversion = totales.asignadosMes > 0
    ? Math.round((totales.ventasMes / totales.asignadosMes) * 10000) / 100
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">
        Comparativa por {label === "Sucursal" ? "Sucursales" : "Equipos"}
      </h1>

      {unidades.length === 0 ? (
        <p className="text-slate-500">No hay {label === "Sucursal" ? "sucursales" : "equipos"} en tu alcance</p>
      ) : (
        <>
          {/* Gráfica de barras comparativa */}
          <div className="bg-card border border-slate-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Ventas del Mes</h2>
            <div className="space-y-3">
              {[...unidades].sort((a, b) => b.ventasMes - a.ventasMes).map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 w-32 truncate">{u.nombre}</span>
                  <div className="flex-1 h-8 bg-slate-800 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-green-500/50 rounded-lg transition-all duration-500"
                      style={{ width: `${Math.max((u.ventasMes / maxVentas) * 100, 3)}%` }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white">
                      {u.ventasMes} ventas — ${u.montoMes.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla comparativa */}
          <div className="bg-card border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
                    <th className="px-3 py-3 text-left">{label}</th>
                    {tipo === "equipos" && <th className="px-3 py-3 text-left">Supervisor</th>}
                    <th className="px-3 py-3 text-right">Promotores</th>
                    <th className="px-3 py-3 text-right">Opp. Activas</th>
                    <th className="px-3 py-3 text-right">Asignados (mes)</th>
                    <th className="px-3 py-3 text-right">Ventas</th>
                    <th className="px-3 py-3 text-right">Monto</th>
                    <th className="px-3 py-3 text-right">Conversión</th>
                    <th className="px-3 py-3 text-right">Interacciones</th>
                  </tr>
                </thead>
                <tbody>
                  {[...unidades].sort((a, b) => b.ventasMes - a.ventasMes).map((u, i) => (
                    <tr key={u.id} className={`border-b border-slate-800/50 ${i % 2 === 0 ? "bg-slate-900/30" : ""}`}>
                      <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{u.nombre}</td>
                      {tipo === "equipos" && (
                        <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{u.supervisor ?? "—"}</td>
                      )}
                      <td className="px-3 py-2.5 text-right text-slate-300">{u.promotores}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{u.oppActivas}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{u.asignadosMes}</td>
                      <td className="px-3 py-2.5 text-right text-white font-semibold">{u.ventasMes}</td>
                      <td className="px-3 py-2.5 text-right text-green-400">${u.montoMes.toLocaleString()}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${
                        u.conversion >= 20 ? "text-green-400" : u.conversion >= 10 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {u.conversion}%
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{u.interaccionesMes}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-700 bg-slate-900/60">
                    <td className="px-3 py-2.5 text-amber-400 font-semibold">TOTAL</td>
                    {tipo === "equipos" && <td />}
                    <td className="px-3 py-2.5 text-right text-amber-400 font-semibold">{totales.promotores}</td>
                    <td className="px-3 py-2.5 text-right text-amber-400 font-semibold">{totales.oppActivas}</td>
                    <td className="px-3 py-2.5 text-right text-amber-400 font-semibold">{totales.asignadosMes}</td>
                    <td className="px-3 py-2.5 text-right text-amber-400 font-semibold">{totales.ventasMes}</td>
                    <td className="px-3 py-2.5 text-right text-amber-400 font-semibold">${totales.montoMes.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-amber-400 font-semibold">{totalConversion}%</td>
                    <td className="px-3 py-2.5 text-right text-amber-400 font-semibold">{totales.interaccionesMes}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
