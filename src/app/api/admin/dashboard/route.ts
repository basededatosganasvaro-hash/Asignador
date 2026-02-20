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

    // Stats por promotor — use raw query for efficient aggregation
    prisma.$queryRaw<
      { id: number; nombre: string; total_lotes: bigint; total_asignados: bigint; oportunidades_activas: bigint }[]
    >`
      SELECT u.id, u.nombre,
        COUNT(DISTINCT l.id) as total_lotes,
        COALESCE(SUM(l.cantidad), 0) as total_asignados,
        (SELECT COUNT(*) FROM oportunidades o WHERE o.usuario_id = u.id AND o.activo = true) as oportunidades_activas
      FROM usuarios u
      LEFT JOIN lotes l ON l.usuario_id = u.id
      WHERE u.rol = 'promotor' AND u.activo = true
      GROUP BY u.id, u.nombre
    `,
  ]);

  const porPromotor = promotoresStats.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    total_lotes: Number(p.total_lotes),
    total_asignados: Number(p.total_asignados),
    oportunidades_activas: Number(p.oportunidades_activas),
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
