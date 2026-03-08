import { NextResponse } from "next/server";
import { requirePromotorOrSupervisor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config-cache";

const MEXICO_TZ = "America/Mexico_City";

export async function GET() {
  const { session, error } = await requirePromotorOrSupervisor();
  if (error) return error;

  const userId = Number(session.user.id);

  const now = new Date();
  const mx = now.toLocaleDateString("en-CA", { timeZone: MEXICO_TZ });
  const start = new Date(`${mx}T00:00:00-06:00`);
  const end = new Date(`${mx}T23:59:59.999-06:00`);

  const limite = parseInt(await getConfig("max_busquedas_por_dia") || "50");
  const usadas = await prisma.busquedas_clientes.count({
    where: {
      usuario_id: userId,
      created_at: { gte: start, lte: end },
    },
  });

  return NextResponse.json({
    limite,
    usadas,
    restantes: Math.max(0, limite - usadas),
    fecha: mx,
  });
}
