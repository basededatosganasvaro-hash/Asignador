import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGerente } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const { error, scopeFilter } = await requireGerente();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const equipoIdParam = searchParams.get("equipo_id");

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfTrend = new Date(today);
  startOfTrend.setDate(today.getDate() - 56);

  // Equipos en el scope del gerente (para dropdown de filtro)
  const equipoWhere = scopeFilter!.field === "region_id"
    ? { activo: true, sucursal: { zona: { region_id: scopeFilter!.value as number } } }
    : { activo: true, sucursal_id: scopeFilter!.value as number };

  const equipos = await prisma.equipos.findMany({
    where: equipoWhere,
    select: { id: true, nombre: true, sucursal: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  });

  // Filtro de promotores: scope del gerente + opcional por equipo
  const promotorWhere: Record<string, unknown> = {
    rol: "promotor",
    activo: true,
    [scopeFilter!.field]: scopeFilter!.value,
  };
  if (equipoIdParam) {
    promotorWhere.equipo_id = parseInt(equipoIdParam);
  }

  const promotores = await prisma.usuarios.findMany({
    where: promotorWhere,
    select: { id: true, nombre: true, equipo: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  });
  const promotorIds = promotores.map((p) => p.id);

  // Etapas activas
  const etapas = await prisma.embudo_etapas.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
    select: { id: true, nombre: true, color: true, tipo: true },
  });

  if (promotorIds.length === 0) {
    return NextResponse.json({
      equipos,
      etapas,
      promotores: [],
      totales: {},
      totalGeneral: 0,
      kpis: {
        promotoresActivos: 0,
        oportunidadesActivas: 0,
        ventasMes: 0,
        montoMes: 0,
        conversionGlobal: 0,
        timersVencidosMes: 0,
      },
      embudo: [],
      tendencia: [],
    });
  }

  // Queries en paralelo
  const [
    oppCounts,
    oportunidadesActivas,
    ventasMes,
    totalAsignadosMes,
    timersVencidosMes,
    etapaCounts,
    tendenciaRaw,
  ] = await Promise.all([
    // Tabla promotores x etapas
    prisma.oportunidades.groupBy({
      by: ["usuario_id", "etapa_id"],
      where: { usuario_id: { in: promotorIds }, activo: true },
      _count: { id: true },
    }),

    // KPI: Oportunidades activas
    prisma.oportunidades.count({
      where: { usuario_id: { in: promotorIds }, activo: true },
    }),

    // KPI: Ventas del mes
    prisma.ventas.aggregate({
      where: { usuario_id: { in: promotorIds }, created_at: { gte: startOfMonth } },
      _count: { id: true },
      _sum: { monto: true },
    }),

    // KPI: Total asignados mes (para conversión)
    prisma.oportunidades.count({
      where: { usuario_id: { in: promotorIds }, created_at: { gte: startOfMonth } },
    }),

    // KPI: Timers vencidos mes
    prisma.historial.count({
      where: {
        usuario_id: { in: promotorIds },
        tipo: "TIMER_VENCIDO",
        created_at: { gte: startOfMonth },
      },
    }),

    // Embudo
    prisma.oportunidades.groupBy({
      by: ["etapa_id"],
      where: { usuario_id: { in: promotorIds }, activo: true },
      _count: { id: true },
    }),

    // Tendencia semanal
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

  // Build tabla promotores x etapas
  const countMap = new Map<number, Map<number, number>>();
  for (const c of oppCounts) {
    if (!c.usuario_id || !c.etapa_id) continue;
    if (!countMap.has(c.usuario_id)) countMap.set(c.usuario_id, new Map());
    countMap.get(c.usuario_id)!.set(c.etapa_id, c._count.id);
  }

  const promotoresData = promotores.map((p) => {
    const etapaCnts = countMap.get(p.id) || new Map();
    const porEtapa: Record<number, number> = {};
    let total = 0;
    for (const [etapaId, count] of etapaCnts) {
      porEtapa[etapaId] = count;
      total += count;
    }
    return { id: p.id, nombre: p.nombre, equipo: p.equipo?.nombre ?? null, porEtapa, total };
  });

  const totales: Record<number, number> = {};
  let totalGeneral = 0;
  for (const p of promotoresData) {
    for (const [etapaId, count] of Object.entries(p.porEtapa)) {
      totales[Number(etapaId)] = (totales[Number(etapaId)] || 0) + count;
    }
    totalGeneral += p.total;
  }

  // Embudo
  const embudo = etapas.map((e) => {
    const found = etapaCounts.find((c) => c.etapa_id === e.id);
    return { id: e.id, nombre: e.nombre, color: e.color, tipo: e.tipo, count: found?._count?.id ?? 0 };
  });

  // KPIs
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
    equipos,
    etapas,
    promotores: promotoresData,
    totales,
    totalGeneral,
    kpis: {
      promotoresActivos: promotoresData.length,
      oportunidadesActivas,
      ventasMes: ventasCount,
      montoMes: Number(ventasMes._sum.monto ?? 0),
      conversionGlobal,
      timersVencidosMes,
    },
    embudo,
    tendencia,
  });
}
