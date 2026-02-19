import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/asignaciones/cupo
 * Devuelve el cupo diario restante del promotor autenticado.
 */
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = parseInt(session.user.id);

  // Fecha de hoy en timezone Mexico
  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());

  const config = await prisma.configuracion.findUnique({
    where: { clave: "max_registros_por_dia" },
  });
  const limite = parseInt(config?.valor || "300");

  let totalAsignado = 0;
  try {
    const cupo = await prisma.cupo_diario.findUnique({
      where: { usuario_id_fecha: { usuario_id: userId, fecha: today } },
    });
    totalAsignado = cupo?.total_asignado ?? 0;
  } catch {
    // Fallback: tabla cupo_diario no existe aún
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const lotesHoy = await prisma.lotes.findMany({
      where: { usuario_id: userId, fecha: { gte: today, lt: tomorrow } },
      select: { cantidad: true },
    });
    totalAsignado = lotesHoy.reduce((s, l) => s + l.cantidad, 0);
  }
  const restante = Math.max(0, limite - totalAsignado);

  return NextResponse.json({
    limite,
    total_asignado: totalAsignado,
    restante,
    fecha: today.toISOString().split("T")[0],
  });
}
