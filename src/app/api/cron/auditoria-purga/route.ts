import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * CRON diario. Elimina registros de access_log con más de N días
 * (configurable por env RETENCION_AUDITORIA_DIAS, default 90).
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const diasRetencion = parseInt(process.env.RETENCION_AUDITORIA_DIAS ?? "90");
  const corte = new Date();
  corte.setDate(corte.getDate() - diasRetencion);

  const result = await prisma.access_log.deleteMany({
    where: { created_at: { lt: corte } },
  });

  return NextResponse.json({
    ok: true,
    retencion_dias: diasRetencion,
    corte: corte.toISOString(),
    eliminados: result.count,
  });
}
