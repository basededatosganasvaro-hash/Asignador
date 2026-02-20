import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ahora = new Date();

  // Find expired oportunidades
  const vencidas = await prisma.oportunidades.findMany({
    where: {
      activo: true,
      timer_vence: { lt: ahora },
    },
    select: { id: true, etapa_id: true, usuario_id: true },
  });

  if (vencidas.length === 0) {
    return NextResponse.json({ expiradas: 0 });
  }

  // System user for historial (use first admin)
  const admin = await prisma.usuarios.findFirst({ where: { rol: "admin" } });
  const sistemaUserId = admin?.id ?? 1;

  const vencidaIds = vencidas.map((op) => op.id);
  await prisma.oportunidades.updateMany({
    where: { id: { in: vencidaIds } },
    data: { activo: false, etapa_id: null, timer_vence: null },
  });

  await prisma.historial.createMany({
    data: vencidas.map((op) => ({
      oportunidad_id: op.id,
      usuario_id: sistemaUserId,
      tipo: "TIMER_VENCIDO",
      etapa_anterior_id: op.etapa_id,
      etapa_nueva_id: null,
      nota: "Timer vencido — oportunidad devuelta al pool automáticamente",
    })),
  });

  return NextResponse.json({ expiradas: vencidas.length });
}
