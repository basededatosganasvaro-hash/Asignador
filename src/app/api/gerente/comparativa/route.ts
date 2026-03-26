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

    if (sucursales.length === 0) {
      return NextResponse.json({ tipo: "sucursales", unidades: [] });
    }

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
