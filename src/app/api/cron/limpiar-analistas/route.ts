import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ahora = new Date();

  // 1. Limpiar lotes PENDIENTES o EN_PROCESO del día anterior (no finalizados)
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(0, 0, 0, 0);

  const lotesVencidos = await prisma.lotes_analista.findMany({
    where: {
      fecha: { lt: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()) },
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
    select: { id: true },
  });

  let calificacionesLimpiadas = 0;
  let lotesLimpiados = 0;

  if (lotesVencidos.length > 0) {
    const loteIds = lotesVencidos.map((l) => l.id);

    // Eliminar calificaciones no completadas de esos lotes
    const result = await prisma.calificaciones_analista.deleteMany({
      where: {
        lote_id: { in: loteIds },
        calificado: false,
      },
    });
    calificacionesLimpiadas = result.count;

    // Marcar lotes como LIMPIADO
    await prisma.lotes_analista.updateMany({
      where: { id: { in: loteIds } },
      data: { estado: "LIMPIADO" },
    });
    lotesLimpiados = loteIds.length;
  }

  // 2. Limpiar pool_gerente expirado (6 meses)
  const poolExpirado = await prisma.pool_gerente.deleteMany({
    where: {
      expira_at: { lt: ahora },
      asignado: false,
    },
  });

  return NextResponse.json({
    lotes_limpiados: lotesLimpiados,
    calificaciones_limpiadas: calificacionesLimpiadas,
    pool_expirado: poolExpirado.count,
  });
}
