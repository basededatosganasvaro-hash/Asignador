import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import {
  FUENTES_CALIFICACION as FUENTES,
  type FuenteCalificacion as Fuente,
  parseRangoCalificacion,
} from "@/lib/calificacion-avance";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { gte, lte } = parseRangoCalificacion(req.nextUrl.searchParams);

  const [univIeppo, univCdmx, univPens, rondas, histGroups, rangoGroups, lotesRango] =
    await Promise.all([
      prismaClientes.clientes.count({
        where: { tipo_cliente: "Cartera para calificar IEPPO" },
      }),
      prisma.clientes_cdmx.count(),
      prisma.clientes_pensionados.count(),
      prisma.rondas_calificacion.findMany(),
      prisma.calificaciones_promotor.groupBy({
        by: ["tipo"],
        where: { calificado: true },
        _count: { _all: true },
      }),
      prisma.calificaciones_promotor.groupBy({
        by: ["tipo", "calificado"],
        where: { lote: { fecha: { gte, lte } } },
        _count: { _all: true },
      }),
      prisma.lotes_calificacion_promotor.findMany({
        where: { fecha: { gte, lte } },
        select: { promotor_id: true, tipo: true, estado: true },
      }),
    ]);

  const universo: Record<Fuente, number> = {
    IEPPO: univIeppo,
    CDMX: univCdmx,
    PENSIONADOS: univPens,
  };

  const rondaByTipo: Record<string, number> = {};
  rondas.forEach((r) => {
    rondaByTipo[r.tipo] = r.ronda_actual;
  });

  const histByTipo: Record<string, number> = {};
  histGroups.forEach((g) => {
    histByTipo[g.tipo] = g._count._all;
  });

  const asignadosRango: Record<Fuente, number> = { IEPPO: 0, CDMX: 0, PENSIONADOS: 0 };
  const calificadosRango: Record<Fuente, number> = { IEPPO: 0, CDMX: 0, PENSIONADOS: 0 };
  rangoGroups.forEach((g) => {
    const f = g.tipo as Fuente;
    if (!FUENTES.includes(f)) return;
    asignadosRango[f] += g._count._all;
    if (g.calificado) calificadosRango[f] += g._count._all;
  });

  const promotoresPorFuente: Record<Fuente, Set<number>> = {
    IEPPO: new Set(),
    CDMX: new Set(),
    PENSIONADOS: new Set(),
  };
  const lotesEstados: Record<
    Fuente,
    { PENDIENTE: number; EN_PROCESO: number; DEVUELTO: number; total: number }
  > = {
    IEPPO: { PENDIENTE: 0, EN_PROCESO: 0, DEVUELTO: 0, total: 0 },
    CDMX: { PENDIENTE: 0, EN_PROCESO: 0, DEVUELTO: 0, total: 0 },
    PENSIONADOS: { PENDIENTE: 0, EN_PROCESO: 0, DEVUELTO: 0, total: 0 },
  };
  lotesRango.forEach((l) => {
    const f = l.tipo as Fuente;
    if (!FUENTES.includes(f)) return;
    promotoresPorFuente[f].add(l.promotor_id);
    lotesEstados[f].total++;
    const estado = l.estado as "PENDIENTE" | "EN_PROCESO" | "DEVUELTO";
    if (estado in lotesEstados[f]) {
      lotesEstados[f][estado]++;
    }
  });

  const data = FUENTES.map((fuente) => {
    const univ = universo[fuente];
    const calHist = histByTipo[fuente] ?? 0;
    const asignados = asignadosRango[fuente];
    const calificados = calificadosRango[fuente];
    return {
      fuente,
      ronda_actual: rondaByTipo[fuente] ?? 1,
      universo: univ,
      calificados_historico: calHist,
      pct_avance_total: univ > 0 ? Math.round((calHist / univ) * 10000) / 100 : 0,
      asignados_rango: asignados,
      calificados_rango: calificados,
      pendientes_rango: asignados - calificados,
      pct_avance_rango: asignados > 0 ? Math.round((calificados / asignados) * 10000) / 100 : 0,
      promotores_activos: promotoresPorFuente[fuente].size,
      lotes: lotesEstados[fuente],
    };
  });

  return NextResponse.json({
    desde: gte.toISOString().slice(0, 10),
    hasta: lte.toISOString().slice(0, 10),
    data,
  });
}
