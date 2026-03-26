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
  const lotesVencidos = await prisma.lotes_analista.findMany({
    where: {
      fecha: { lt: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()) },
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
    select: { id: true },
  });

  let calificacionesLimpiadas = 0;
  let lotesLimpiados = 0;
  let calificadosRescatados = 0;

  if (lotesVencidos.length > 0) {
    const loteIds = lotesVencidos.map((l) => l.id);

    // Envolver rescue + delete + update en transacción para evitar inconsistencias (C9)
    const txResult = await prisma.$transaction(async (tx) => {
      // Rescatar registros calificados: moverlos al pool del gerente antes de limpiar
      const calificados = await tx.calificaciones_analista.findMany({
        where: {
          lote_id: { in: loteIds },
          calificado: true,
        },
        include: { analista: { select: { region_id: true } } },
      });

      let rescatados = 0;
      if (calificados.length > 0) {
        const seisMeses = new Date(ahora);
        seisMeses.setMonth(seisMeses.getMonth() + 6);

        await tx.pool_gerente.createMany({
          data: calificados.map((c) => ({
            cliente_id: c.cliente_id,
            calificado_por: c.analista_id,
            region_id: c.analista?.region_id ?? null,
            expira_at: seisMeses,
          })),
          skipDuplicates: true,
        });
        rescatados = calificados.length;
      }

      // Eliminar calificaciones no completadas de esos lotes
      const deleteResult = await tx.calificaciones_analista.deleteMany({
        where: {
          lote_id: { in: loteIds },
          calificado: false,
        },
      });

      // Marcar lotes como LIMPIADO
      await tx.lotes_analista.updateMany({
        where: { id: { in: loteIds } },
        data: { estado: "LIMPIADO" },
      });

      return { rescatados, limpiadas: deleteResult.count, lotes: loteIds.length };
    });

    calificadosRescatados = txResult.rescatados;
    calificacionesLimpiadas = txResult.limpiadas;
    lotesLimpiados = txResult.lotes;
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
    calificados_rescatados: calificadosRescatados,
    pool_expirado: poolExpirado.count,
  });
}
