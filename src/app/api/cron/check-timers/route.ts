import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ahora = new Date();

  // Find expired oportunidades (include etapa to differentiate)
  const vencidas = await prisma.oportunidades.findMany({
    where: {
      activo: true,
      timer_vence: { lt: ahora },
    },
    select: { id: true, etapa_id: true, usuario_id: true, etapa: { select: { nombre: true } } },
  });

  if (vencidas.length === 0) {
    return NextResponse.json({ expiradas_pool: 0, escaladas_supervisor: 0 });
  }

  // System user for historial
  const admin = await prisma.usuarios.findFirst({ where: { rol: "admin" } });
  const sistemaUserId = admin?.id ?? 1;

  // Separar: "Asignado" → pool, resto → escalar al supervisor
  const alPool = vencidas.filter((op) => op.etapa?.nombre === "Asignado");
  const alSupervisor = vencidas.filter((op) => op.etapa?.nombre !== "Asignado");

  // Asignado → devolver al pool (comportamiento original)
  if (alPool.length > 0) {
    const poolIds = alPool.map((op) => op.id);
    await prisma.oportunidades.updateMany({
      where: { id: { in: poolIds } },
      data: { activo: false, etapa_id: null, timer_vence: null },
    });

    await prisma.historial.createMany({
      data: alPool.map((op) => ({
        oportunidad_id: op.id,
        usuario_id: sistemaUserId,
        tipo: "TIMER_VENCIDO",
        etapa_anterior_id: op.etapa_id,
        etapa_nueva_id: null,
        nota: "Timer vencido — oportunidad devuelta al pool automaticamente",
      })),
    });
  }

  // Contactado/Interesado/Negociacion → escalar al supervisor (mantiene etapa y activo)
  if (alSupervisor.length > 0) {
    const supIds = alSupervisor.map((op) => op.id);
    await prisma.oportunidades.updateMany({
      where: { id: { in: supIds } },
      data: { escalada_supervisor: true, timer_vence: null },
    });

    await prisma.historial.createMany({
      data: alSupervisor.map((op) => ({
        oportunidad_id: op.id,
        usuario_id: sistemaUserId,
        tipo: "TIMER_VENCIDO",
        etapa_anterior_id: op.etapa_id,
        etapa_nueva_id: op.etapa_id,
        nota: "Timer vencido — escalada al supervisor para reasignacion",
      })),
    });
  }

  return NextResponse.json({
    expiradas_pool: alPool.length,
    escaladas_supervisor: alSupervisor.length,
  });
}
