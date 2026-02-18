import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorOrAdmin } from "@/lib/auth-utils";

export async function GET() {
  const { session, error } = await requireSupervisorOrAdmin();
  if (error) return error;

  const userId = Number(session!.user.id);
  const rol = session!.user.rol;

  let equipoId: number | undefined;
  if (rol === "supervisor") {
    const sup = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { equipo_id: true },
    });
    equipoId = sup?.equipo_id ?? undefined;
  }

  const promotores = await prisma.usuarios.findMany({
    where: {
      rol: "promotor",
      activo: true,
      ...(equipoId !== undefined ? { equipo_id: equipoId } : {}),
    },
    include: {
      oportunidades: {
        where: { activo: true },
        include: { etapa: { select: { tipo: true } } },
      },
    },
    orderBy: { nombre: "asc" },
  });

  const result = promotores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    email: p.email,
    activo: p.activo,
    total_activas: p.oportunidades.length,
    en_salida: p.oportunidades.filter((o) => o.etapa?.tipo === "SALIDA").length,
    en_avance: p.oportunidades.filter((o) => o.etapa?.tipo === "AVANCE").length,
  }));

  return NextResponse.json(result);
}
