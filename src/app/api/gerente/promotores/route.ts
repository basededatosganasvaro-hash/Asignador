import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGerente } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const { error, scopeFilter } = await requireGerente();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const periodo = searchParams.get("periodo") || "mes";

  // Calcular fecha inicio según periodo
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

  const promotores = await prisma.usuarios.findMany({
    where: {
      rol: "promotor",
      activo: true,
      [scopeFilter!.field]: scopeFilter!.value,
    },
    select: {
      id: true,
      nombre: true,
      equipo: { select: { nombre: true, sucursal: { select: { nombre: true } } } },
    },
    orderBy: { nombre: "asc" },
  });

  const promotorIds = promotores.map((p) => p.id);
  if (promotorIds.length === 0) {
    return NextResponse.json({ promotores: [] });
  }

  // Queries en paralelo
  const [
    oppActivas,
    oppAsignadas,
    ventasData,
    interacciones,
    timersVencidos,
    cuposHoy,
  ] = await Promise.all([
    // Oportunidades activas por promotor
    prisma.oportunidades.groupBy({
      by: ["usuario_id"],
      where: { usuario_id: { in: promotorIds }, activo: true },
      _count: { id: true },
    }),

    // Oportunidades asignadas en periodo
    prisma.oportunidades.groupBy({
      by: ["usuario_id"],
      where: { usuario_id: { in: promotorIds }, created_at: { gte: desde } },
      _count: { id: true },
    }),

    // Ventas en periodo (count + monto)
    prisma.$queryRaw<{ usuario_id: number; count: bigint; monto: number }[]>`
      SELECT usuario_id, COUNT(*) as count, COALESCE(SUM(monto), 0) as monto
      FROM ventas
      WHERE usuario_id = ANY(${promotorIds}::int[])
        AND created_at >= ${desde}
      GROUP BY usuario_id
    `,

    // Interacciones en periodo
    prisma.historial.groupBy({
      by: ["usuario_id"],
      where: {
        usuario_id: { in: promotorIds },
        created_at: { gte: desde },
        tipo: { in: ["CAMBIO_ETAPA", "NOTA", "LLAMADA", "WHATSAPP", "SMS"] },
      },
      _count: { id: true },
    }),

    // Timers vencidos en periodo
    prisma.historial.groupBy({
      by: ["usuario_id"],
      where: {
        usuario_id: { in: promotorIds },
        tipo: "TIMER_VENCIDO",
        created_at: { gte: desde },
      },
      _count: { id: true },
    }),

    // Cupo usado hoy
    prisma.cupo_diario.findMany({
      where: { usuario_id: { in: promotorIds }, fecha: today },
      select: { usuario_id: true, total_asignado: true, limite: true },
    }),
  ]);

  // Tiempo promedio en embudo (días desde asignación hasta venta)
  const tiempoPromedio = await prisma.$queryRaw<{ usuario_id: number; dias_promedio: number }[]>`
    SELECT v.usuario_id,
           ROUND(AVG(EXTRACT(EPOCH FROM (v.created_at - o.created_at)) / 86400)::numeric, 1) as dias_promedio
    FROM ventas v
    JOIN oportunidades o ON o.id = v.oportunidad_id
    WHERE v.usuario_id = ANY(${promotorIds}::int[])
      AND v.created_at >= ${desde}
    GROUP BY v.usuario_id
  `;

  // Build lookup maps
  const activasMap = new Map(oppActivas.map((o) => [o.usuario_id, o._count.id]));
  const asignadasMap = new Map(oppAsignadas.map((o) => [o.usuario_id, o._count.id]));
  const ventasMap = new Map(ventasData.map((v) => [v.usuario_id, { count: Number(v.count), monto: Number(v.monto) }]));
  const interaccionesMap = new Map(interacciones.map((i) => [i.usuario_id, i._count.id]));
  const timersMap = new Map(timersVencidos.map((t) => [t.usuario_id, t._count.id]));
  const cupoMap = new Map(cuposHoy.map((c) => [c.usuario_id, c.total_asignado]));
  const tiempoMap = new Map(tiempoPromedio.map((t) => [t.usuario_id, Number(t.dias_promedio)]));

  const result = promotores.map((p) => {
    const ventas = ventasMap.get(p.id) ?? { count: 0, monto: 0 };
    const asignadas = asignadasMap.get(p.id) ?? 0;
    const conversion = asignadas > 0 ? Math.round((ventas.count / asignadas) * 10000) / 100 : 0;

    return {
      id: p.id,
      nombre: p.nombre,
      equipo: p.equipo?.nombre ?? null,
      sucursal: p.equipo?.sucursal?.nombre ?? null,
      oppActivas: activasMap.get(p.id) ?? 0,
      asignadas,
      ventas: ventas.count,
      monto: ventas.monto,
      conversion,
      interacciones: interaccionesMap.get(p.id) ?? 0,
      diasPromedio: tiempoMap.get(p.id) ?? null,
      timersVencidos: timersMap.get(p.id) ?? 0,
      cupoHoy: cupoMap.get(p.id) ?? 0,
    };
  });

  return NextResponse.json({ promotores: result });
}
