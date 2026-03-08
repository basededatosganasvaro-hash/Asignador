import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisor } from "@/lib/auth-utils";

export async function GET() {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const userId = Number(session!.user.id);

  // Obtener equipo del supervisor
  const equipo = await prisma.equipos.findFirst({
    where: { supervisor_id: userId },
    select: { id: true, nombre: true },
  });

  if (!equipo) {
    return NextResponse.json({ equipo: null, promotores: [] });
  }

  // Obtener promotores del equipo (activos e inactivos)
  const promotores = await prisma.usuarios.findMany({
    where: { equipo_id: equipo.id, rol: "promotor" },
    select: {
      id: true,
      nombre: true,
      username: true,
      activo: true,
      created_at: true,
      _count: {
        select: {
          oportunidades: { where: { activo: true } },
          lotes: true,
          ventas: true,
        },
      },
    },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });

  return NextResponse.json({
    equipo: { id: equipo.id, nombre: equipo.nombre },
    promotores: promotores.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      username: p.username,
      activo: p.activo,
      created_at: p.created_at,
      oportunidades_activas: p._count.oportunidades,
      lotes: p._count.lotes,
      ventas: p._count.ventas,
    })),
  });
}
