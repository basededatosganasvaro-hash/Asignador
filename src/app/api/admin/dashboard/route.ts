import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireGestion } from "@/lib/auth-utils";

export async function GET() {
  const { error } = await requireGestion();
  if (error) return error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    totalClientes,
    clientesAsignados,
    totalPromotores,
    lotesHoy,
    promotoresStats,
  ] = await Promise.all([
    // Total de clientes en BD Clientes
    prismaClientes.clientes.count(),

    // Clientes con oportunidad activa en BD Sistema
    prisma.oportunidades.count({ where: { activo: true } }),

    // Promotores activos en BD Sistema
    prisma.usuarios.count({ where: { rol: "promotor", activo: true } }),

    // Lotes creados hoy
    prisma.lotes.count({ where: { fecha: { gte: today, lt: tomorrow } } }),

    // Stats por promotor
    prisma.usuarios.findMany({
      where: { rol: "promotor", activo: true },
      select: {
        id: true,
        nombre: true,
        lotes: { select: { cantidad: true } },
        oportunidades: { where: { activo: true }, select: { id: true } },
      },
    }),
  ]);

  const porPromotor = promotoresStats.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    total_lotes: p.lotes.length,
    total_asignados: p.lotes.reduce((sum, l) => sum + l.cantidad, 0),
    oportunidades_activas: p.oportunidades.length,
  }));

  return NextResponse.json({
    totalClientes,
    clientesAsignados,
    clientesDisponibles: totalClientes - clientesAsignados,
    totalPromotores,
    lotesHoy,
    porPromotor,
  });
}
