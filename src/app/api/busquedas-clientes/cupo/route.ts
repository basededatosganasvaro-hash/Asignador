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
  // Calcular offset dinámico para DST
  const offsetFmt = new Intl.DateTimeFormat("en-US", { timeZone: MEXICO_TZ, timeZoneName: "shortOffset" });
  const offsetPart = offsetFmt.formatToParts(now).find(p => p.type === "timeZoneName")?.value || "GMT-6";
  const offsetStr = offsetPart.replace("GMT", "") || "+0";
  const sign = offsetStr.startsWith("-") ? "-" : "+";
  const absHours = Math.abs(parseInt(offsetStr));
  const offset = `${sign}${String(absHours).padStart(2, "0")}:00`;
  const start = new Date(`${mx}T00:00:00${offset}`);
  const end = new Date(`${mx}T23:59:59.999${offset}`);

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
