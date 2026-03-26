import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 200;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ahora = new Date();

  // System user for historial
  const admin = await prisma.usuarios.findFirst({ where: { rol: "admin", activo: true } });
  if (!admin) {
    return NextResponse.json({ error: "No active admin user found for historial" }, { status: 500 });
  }
  const sistemaUserId = admin.id;

  let totalPool = 0;
  let totalSupervisor = 0;

  // Procesar en batches para no sobrecargar con miles de registros
  const MAX_ITERATIONS = 1000; // safety break to prevent infinite loops
  let hasMore = true;
  let iterations = 0;
  while (hasMore && iterations < MAX_ITERATIONS) {
    iterations++;
    const vencidas = await prisma.oportunidades.findMany({
      where: {
        activo: true,
        timer_vence: { lt: ahora },
        origen: { not: "CAPACIDADES" },
      },
      select: { id: true, etapa_id: true, usuario_id: true, etapa: { select: { nombre: true } } },
      take: BATCH_SIZE,
    });

    if (vencidas.length === 0) {
      hasMore = false;
      break;
    }

    // Separar: "Asignado" → pool, resto → escalar al supervisor
    const alPool = vencidas.filter((op) => op.etapa?.nombre === "Asignado");
    const alSupervisor = vencidas.filter((op) => op.etapa?.nombre !== "Asignado");

    // Asignado → devolver al pool en transacción
    if (alPool.length > 0) {
      const poolIds = alPool.map((op) => op.id);
      await prisma.$transaction([
        prisma.oportunidades.updateMany({
          where: { id: { in: poolIds } },
          data: { activo: false, etapa_id: null, timer_vence: null },
        }),
        prisma.historial.createMany({
          data: alPool.map((op) => ({
            oportunidad_id: op.id,
            usuario_id: sistemaUserId,
            tipo: "TIMER_VENCIDO",
            etapa_anterior_id: op.etapa_id,
            etapa_nueva_id: null,
            nota: "Timer vencido — oportunidad devuelta al pool automaticamente",
          })),
        }),
      ]);
      totalPool += alPool.length;
    }

    // Contactado/Interesado/Negociacion → escalar al supervisor en transacción
    if (alSupervisor.length > 0) {
      const supIds = alSupervisor.map((op) => op.id);
      await prisma.$transaction([
        prisma.oportunidades.updateMany({
          where: { id: { in: supIds } },
          data: { escalada_supervisor: true, timer_vence: null },
        }),
        prisma.historial.createMany({
          data: alSupervisor.map((op) => ({
            oportunidad_id: op.id,
            usuario_id: sistemaUserId,
            tipo: "TIMER_VENCIDO",
            etapa_anterior_id: op.etapa_id,
            etapa_nueva_id: op.etapa_id,
            nota: "Timer vencido — escalada al supervisor para reasignacion",
          })),
        }),
      ]);
      totalSupervisor += alSupervisor.length;
    }

    // Si el batch fue menor que BATCH_SIZE, no hay más
    if (vencidas.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  return NextResponse.json({
    expiradas_pool: totalPool,
    escaladas_supervisor: totalSupervisor,
  });
}
