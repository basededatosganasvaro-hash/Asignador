import { NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { session, error } = await requirePromotor();
  if (error) return error;

  const userId = Number(session.user.id);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const cupo = await prisma.cupo_calificacion_diario.findUnique({
    where: { usuario_id_fecha: { usuario_id: userId, fecha: hoy } },
  });

  const totalAsignado = cupo?.total_asignado ?? 0;
  const limite = cupo?.limite ?? 50;

  return NextResponse.json({
    total_asignado: totalAsignado,
    limite,
    disponible: Math.max(0, limite - totalAsignado),
  });
}
