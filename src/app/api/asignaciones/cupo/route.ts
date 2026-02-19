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

  const cupo = await prisma.cupo_diario.findUnique({
    where: { usuario_id_fecha: { usuario_id: userId, fecha: today } },
  });

  const totalAsignado = cupo?.total_asignado ?? 0;
  const restante = Math.max(0, limite - totalAsignado);

  return NextResponse.json({
    limite,
    total_asignado: totalAsignado,
    restante,
    fecha: today.toISOString().split("T")[0],
  });
}
