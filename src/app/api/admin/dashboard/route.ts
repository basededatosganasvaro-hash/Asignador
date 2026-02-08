import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalClientes,
    clientesAsignados,
    totalPromotores,
    asignacionesHoy,
    asignacionesPorPromotor,
  ] = await Promise.all([
    prisma.clientes.count(),
    prisma.asignacion_registros.count(),
    prisma.usuarios.count({ where: { rol: "promotor", activo: true } }),
    prisma.asignaciones.count({
      where: { fecha_asignacion: today },
    }),
    prisma.usuarios.findMany({
      where: { rol: "promotor", activo: true },
      select: {
        id: true,
        nombre: true,
        asignaciones: {
          select: {
            cantidad_registros: true,
          },
        },
      },
    }),
  ]);

  const promotoresStats = asignacionesPorPromotor.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    total_asignaciones: p.asignaciones.length,
    total_registros: p.asignaciones.reduce(
      (sum, a) => sum + a.cantidad_registros,
      0
    ),
  }));

  return NextResponse.json({
    totalClientes,
    clientesAsignados,
    clientesDisponibles: totalClientes - clientesAsignados,
    totalPromotores,
    asignacionesHoy,
    asignacionesPorPromotor: promotoresStats,
  });
}
