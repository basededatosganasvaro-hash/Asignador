import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGerente } from "@/lib/auth-utils";

export async function GET() {
  const { session, error, scopeFilter } = await requireGerente();
  if (error) return error;

  const rol = session!.user.rol;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (rol === "gerente_regional") {
    // Comparativa entre sucursales de la región
    const sucursales = await prisma.sucursales.findMany({
      where: {
        zona: { region_id: scopeFilter!.value as number },
        activo: true,
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });

    const sucursalIds = sucursales.map((s) => s.id);
    if (sucursalIds.length === 0) {
      return NextResponse.json({ tipo: "sucursales", unidades: [] });
    }

    const data = await prisma.$queryRaw<{
      sucursal_id: number;
      promotores: bigint;
      opp_activas: bigint;
      ventas_mes: bigint;
      monto_mes: number;
      asignados_mes: bigint;
      interacciones_mes: bigint;
    }[]>`
      SELECT
        u.sucursal_id,
        COUNT(DISTINCT u.id) as promotores,
        COUNT(DISTINCT CASE WHEN o.activo = true THEN o.id END) as opp_activas,
        COUNT(DISTINCT v.id) as ventas_mes,
        COALESCE(SUM(DISTINCT v.monto), 0) as monto_mes,
        COUNT(DISTINCT CASE WHEN o.created_at >= ${startOfMonth} THEN o.id END) as asignados_mes,
        (SELECT COUNT(*) FROM historial h
         WHERE h.usuario_id = u.id
           AND h.created_at >= ${startOfMonth}
           AND h.tipo IN ('CAMBIO_ETAPA','NOTA','LLAMADA','WHATSAPP','SMS')
        ) as interacciones_mes
      FROM usuarios u
      LEFT JOIN oportunidades o ON o.usuario_id = u.id
      LEFT JOIN ventas v ON v.usuario_id = u.id AND v.created_at >= ${startOfMonth}
      WHERE u.rol = 'promotor'
        AND u.activo = true
        AND u.sucursal_id = ANY(${sucursalIds}::int[])
      GROUP BY u.sucursal_id, u.id
    `;

    // Agregar por sucursal
    const sucMap = new Map<number, {
      promotores: Set<number>;
      oppActivas: number;
      ventasMes: number;
      montoMes: number;
      asignadosMes: number;
      interaccionesMes: number;
    }>();

    for (const s of sucursalIds) {
      sucMap.set(s, { promotores: new Set(), oppActivas: 0, ventasMes: 0, montoMes: 0, asignadosMes: 0, interaccionesMes: 0 });
    }

    for (const row of data) {
      const entry = sucMap.get(row.sucursal_id);
      if (!entry) continue;
      entry.oppActivas += Number(row.opp_activas);
      entry.ventasMes += Number(row.ventas_mes);
      entry.montoMes += Number(row.monto_mes);
      entry.asignadosMes += Number(row.asignados_mes);
      entry.interaccionesMes += Number(row.interacciones_mes);
      entry.promotores.add(row.sucursal_id); // count distinct is already per user from SQL
    }

    // Simpler approach: query aggregated per sucursal directly
    const unidades = await Promise.all(sucursales.map(async (suc) => {
      const promotoresSuc = await prisma.usuarios.count({
        where: { rol: "promotor", activo: true, sucursal_id: suc.id },
      });
      const [oppActivas, ventasMes, asignadosMes, interaccionesMes] = await Promise.all([
        prisma.oportunidades.count({
          where: { activo: true, usuario: { sucursal_id: suc.id, rol: "promotor" } },
        }),
        prisma.ventas.aggregate({
          where: { usuario: { sucursal_id: suc.id, rol: "promotor" }, created_at: { gte: startOfMonth } },
          _count: { id: true },
          _sum: { monto: true },
        }),
        prisma.oportunidades.count({
          where: { usuario: { sucursal_id: suc.id, rol: "promotor" }, created_at: { gte: startOfMonth } },
        }),
        prisma.historial.count({
          where: {
            usuario: { sucursal_id: suc.id, rol: "promotor" },
            created_at: { gte: startOfMonth },
            tipo: { in: ["CAMBIO_ETAPA", "NOTA", "LLAMADA", "WHATSAPP", "SMS"] },
          },
        }),
      ]);

      const conversion = asignadosMes > 0
        ? Math.round((ventasMes._count.id / asignadosMes) * 10000) / 100
        : 0;

      return {
        id: suc.id,
        nombre: suc.nombre,
        promotores: promotoresSuc,
        oppActivas,
        ventasMes: ventasMes._count.id,
        montoMes: Number(ventasMes._sum.monto ?? 0),
        asignadosMes,
        conversion,
        interaccionesMes,
      };
    }));

    return NextResponse.json({ tipo: "sucursales", unidades });
  }

  // gerente_sucursal: comparativa entre equipos
  const equipos = await prisma.equipos.findMany({
    where: {
      sucursal_id: scopeFilter!.value as number,
      activo: true,
    },
    select: {
      id: true,
      nombre: true,
      supervisor: { select: { nombre: true } },
    },
    orderBy: { nombre: "asc" },
  });

  if (equipos.length === 0) {
    return NextResponse.json({ tipo: "equipos", unidades: [] });
  }

  const unidades = await Promise.all(equipos.map(async (eq) => {
    const promotoresEq = await prisma.usuarios.count({
      where: { rol: "promotor", activo: true, equipo_id: eq.id },
    });
    const [oppActivas, ventasMes, asignadosMes, interaccionesMes] = await Promise.all([
      prisma.oportunidades.count({
        where: { activo: true, usuario: { equipo_id: eq.id, rol: "promotor" } },
      }),
      prisma.ventas.aggregate({
        where: { usuario: { equipo_id: eq.id, rol: "promotor" }, created_at: { gte: startOfMonth } },
        _count: { id: true },
        _sum: { monto: true },
      }),
      prisma.oportunidades.count({
        where: { usuario: { equipo_id: eq.id, rol: "promotor" }, created_at: { gte: startOfMonth } },
      }),
      prisma.historial.count({
        where: {
          usuario: { equipo_id: eq.id, rol: "promotor" },
          created_at: { gte: startOfMonth },
          tipo: { in: ["CAMBIO_ETAPA", "NOTA", "LLAMADA", "WHATSAPP", "SMS"] },
        },
      }),
    ]);

    const conversion = asignadosMes > 0
      ? Math.round((ventasMes._count.id / asignadosMes) * 10000) / 100
      : 0;

    return {
      id: eq.id,
      nombre: eq.nombre,
      supervisor: eq.supervisor?.nombre ?? null,
      promotores: promotoresEq,
      oppActivas,
      ventasMes: ventasMes._count.id,
      montoMes: Number(ventasMes._sum.monto ?? 0),
      asignadosMes,
      conversion,
      interaccionesMes,
    };
  }));

  return NextResponse.json({ tipo: "equipos", unidades });
}
