import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGerente } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const { error, scopeFilter } = await requireGerente();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const periodo = searchParams.get("periodo") || "mes";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let desde: Date;
  if (periodo === "semana") {
    desde = new Date(today);
    desde.setDate(today.getDate() - 7);
  } else if (periodo === "trimestre") {
    desde = new Date(today);
    desde.setMonth(today.getMonth() - 3);
  } else {
    desde = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const promotorIds = (await prisma.usuarios.findMany({
    where: { rol: "promotor", activo: true, [scopeFilter!.field]: scopeFilter!.value },
    select: { id: true },
  })).map((p) => p.id);

  if (promotorIds.length === 0) {
    return NextResponse.json({ etapas: [], salidas: [], tiempos: [] });
  }

  const etapas = await prisma.embudo_etapas.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
    select: { id: true, nombre: true, color: true, tipo: true, orden: true },
  });

  const [countsPorEtapa, transiciones, salidas, tiemposRaw] = await Promise.all([
    // Oportunidades activas por etapa
    prisma.oportunidades.groupBy({
      by: ["etapa_id"],
      where: { usuario_id: { in: promotorIds }, activo: true },
      _count: { id: true },
    }),

    // Transiciones en periodo (para calcular flujo entre etapas)
    prisma.historial.groupBy({
      by: ["etapa_anterior_id", "etapa_nueva_id"],
      where: {
        usuario_id: { in: promotorIds },
        tipo: "CAMBIO_ETAPA",
        created_at: { gte: desde },
      },
      _count: { id: true },
    }),

    // Desglose de salidas en periodo
    prisma.$queryRaw<{ etapa_nombre: string; cantidad: bigint }[]>`
      SELECT ee.nombre as etapa_nombre, COUNT(*) as cantidad
      FROM historial h
      JOIN embudo_etapas ee ON ee.id = h.etapa_nueva_id
      WHERE h.usuario_id = ANY(${promotorIds}::int[])
        AND h.tipo = 'CAMBIO_ETAPA'
        AND h.created_at >= ${desde}
        AND ee.tipo IN ('SALIDA', 'FINAL')
        AND ee.nombre != 'Venta'
      GROUP BY ee.nombre
      ORDER BY cantidad DESC
    `,

    // Tiempo promedio por etapa (días)
    prisma.$queryRaw<{ etapa_id: number; dias_promedio: number }[]>`
      SELECT h2.etapa_anterior_id as etapa_id,
             ROUND(AVG(EXTRACT(EPOCH FROM (h2.created_at - h1.created_at)) / 86400)::numeric, 1) as dias_promedio
      FROM historial h2
      JOIN historial h1 ON h1.oportunidad_id = h2.oportunidad_id
        AND h1.tipo = 'CAMBIO_ETAPA'
        AND h1.etapa_nueva_id = h2.etapa_anterior_id
      WHERE h2.usuario_id = ANY(${promotorIds}::int[])
        AND h2.tipo = 'CAMBIO_ETAPA'
        AND h2.created_at >= ${desde}
      GROUP BY h2.etapa_anterior_id
    `,
  ]);

  const countsMap = new Map(countsPorEtapa.map((c) => [c.etapa_id, c._count.id]));
  const tiemposMap = new Map(tiemposRaw.map((t) => [t.etapa_id, Number(t.dias_promedio)]));

  // Calcular conversión entre etapas consecutivas de AVANCE
  const etapasAvance = etapas.filter((e) => e.tipo === "AVANCE");
  const etapasResult = etapas.map((e) => {
    const count = countsMap.get(e.id) ?? 0;
    // Entradas a esta etapa en el periodo
    const entradas = transiciones
      .filter((t) => t.etapa_nueva_id === e.id)
      .reduce((s, t) => s + t._count.id, 0);
    // Salidas desde esta etapa en el periodo
    const salidaCount = transiciones
      .filter((t) => t.etapa_anterior_id === e.id)
      .reduce((s, t) => s + t._count.id, 0);

    return {
      id: e.id,
      nombre: e.nombre,
      color: e.color,
      tipo: e.tipo,
      count,
      entradas,
      salidaCount,
      diasPromedio: tiemposMap.get(e.id) ?? null,
    };
  });

  // Conversión entre etapas de avance consecutivas
  const conversiones: { de: string; a: string; porcentaje: number }[] = [];
  for (let i = 0; i < etapasAvance.length - 1; i++) {
    const de = etapasAvance[i];
    const a = etapasAvance[i + 1];
    const salidaDe = transiciones
      .filter((t) => t.etapa_anterior_id === de.id)
      .reduce((s, t) => s + t._count.id, 0);
    const llegaron = transiciones
      .filter((t) => t.etapa_anterior_id === de.id && t.etapa_nueva_id === a.id)
      .reduce((s, t) => s + t._count.id, 0);
    conversiones.push({
      de: de.nombre,
      a: a.nombre,
      porcentaje: salidaDe > 0 ? Math.round((llegaron / salidaDe) * 10000) / 100 : 0,
    });
  }

  return NextResponse.json({
    etapas: etapasResult,
    salidas: salidas.map((s) => ({ nombre: s.etapa_nombre, cantidad: Number(s.cantidad) })),
    conversiones,
  });
}
