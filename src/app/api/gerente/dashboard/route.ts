import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGerente } from "@/lib/auth-utils";

export async function GET() {
  const { error, scopeFilter } = await requireGerente();
  if (error) return error;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Inicio de semana (lunes) y mes
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // 8 semanas atrás para tendencia
  const startOfTrend = new Date(today);
  startOfTrend.setDate(today.getDate() - 56);

  // IDs de promotores en el alcance del gerente
  const promotores = await prisma.usuarios.findMany({
    where: {
      rol: "promotor",
      activo: true,
      [scopeFilter!.field]: scopeFilter!.value,
    },
    select: { id: true },
  });
  const promotorIds = promotores.map((p) => p.id);

  if (promotorIds.length === 0) {
    return NextResponse.json({
      kpis: {
        oportunidadesActivas: 0,
        ventasMes: 0,
        montoMes: 0,
        conversionGlobal: 0,
        timersVencidosMes: 0,
        promotoresActivos: 0,
        totalPromotores: 0,
        cupoPromedio: 0,
      },
      embudo: [],
      tendencia: [],
    });
  }

  const [
    oportunidadesActivas,
    ventasMes,
    totalAsignadosMes,
    timersVencidosMes,
    cuposHoy,
    etapaCounts,
    tendenciaRaw,
  ] = await Promise.all([
    // KPI 1: Oportunidades activas
    prisma.oportunidades.count({
      where: { usuario_id: { in: promotorIds }, activo: true },
    }),

    // KPI 2-3: Ventas del mes (count + monto)
    prisma.ventas.aggregate({
      where: { usuario_id: { in: promotorIds }, created_at: { gte: startOfMonth } },
      _count: { id: true },
      _sum: { monto: true },
    }),

    // KPI 4: Total asignados este mes (para tasa de conversión)
    prisma.oportunidades.count({
      where: { usuario_id: { in: promotorIds }, created_at: { gte: startOfMonth } },
    }),

    // KPI 5: Timers vencidos este mes
    prisma.historial.count({
      where: {
        usuario_id: { in: promotorIds },
        tipo: "TIMER_VENCIDO",
        created_at: { gte: startOfMonth },
      },
    }),

    // KPI 6: Cupo diario promedio hoy
    prisma.cupo_diario.findMany({
      where: { usuario_id: { in: promotorIds }, fecha: today },
      select: { total_asignado: true, limite: true },
    }),

    // Embudo: count por etapa
    prisma.oportunidades.groupBy({
      by: ["etapa_id"],
      where: { usuario_id: { in: promotorIds }, activo: true },
      _count: { id: true },
    }),

    // Tendencia: ventas por semana (últimas 8 semanas)
    prisma.$queryRaw<{ semana: Date; cantidad: bigint; monto: number }[]>`
      SELECT date_trunc('week', v.created_at) as semana,
             COUNT(*) as cantidad,
             COALESCE(SUM(v.monto), 0) as monto
      FROM ventas v
      WHERE v.usuario_id = ANY(${promotorIds}::int[])
        AND v.created_at >= ${startOfTrend}
      GROUP BY date_trunc('week', v.created_at)
      ORDER BY semana ASC
    `,
  ]);

  // Etapas para el embudo
  const etapas = await prisma.embudo_etapas.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
    select: { id: true, nombre: true, color: true, tipo: true },
  });

  const embudo = etapas.map((e) => {
    const found = etapaCounts.find((c) => c.etapa_id === e.id);
    return { id: e.id, nombre: e.nombre, color: e.color, tipo: e.tipo, count: found?._count?.id ?? 0 };
  });

  // Promotores activos hoy (que usaron cupo)
  const promotoresActivos = cuposHoy.filter((c) => c.total_asignado > 0).length;
  const cupoPromedio = cuposHoy.length > 0
    ? Math.round(cuposHoy.reduce((s, c) => s + (c.total_asignado / c.limite) * 100, 0) / cuposHoy.length)
    : 0;

  // Conversión global
  const ventasCount = ventasMes._count.id;
  const conversionGlobal = totalAsignadosMes > 0
    ? Math.round((ventasCount / totalAsignadosMes) * 10000) / 100
    : 0;

  const tendencia = tendenciaRaw.map((t) => ({
    semana: t.semana,
    cantidad: Number(t.cantidad),
    monto: Number(t.monto),
  }));

  return NextResponse.json({
    kpis: {
      oportunidadesActivas,
      ventasMes: ventasCount,
      montoMes: Number(ventasMes._sum.monto ?? 0),
      conversionGlobal,
      timersVencidosMes,
      promotoresActivos,
      totalPromotores: promotorIds.length,
      cupoPromedio,
    },
    embudo,
    tendencia,
  });
}
