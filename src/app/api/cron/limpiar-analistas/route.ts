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
  let calificadosRescatados = 0;

  if (lotesVencidos.length > 0) {
    const loteIds = lotesVencidos.map((l) => l.id);

    // Rescatar registros calificados: moverlos al pool del gerente antes de limpiar
    const calificados = await prisma.calificaciones_analista.findMany({
      where: {
        lote_id: { in: loteIds },
        calificado: true,
      },
      include: { analista: { select: { region_id: true } } },
    });

    if (calificados.length > 0) {
      const seisMeses = new Date(ahora);
      seisMeses.setMonth(seisMeses.getMonth() + 6);

      await prisma.pool_gerente.createMany({
        data: calificados.map((c) => ({
          cliente_id: c.cliente_id,
          calificado_por: c.analista_id,
          region_id: c.analista?.region_id ?? null,
          expira_at: seisMeses,
        })),
        skipDuplicates: true,
      });
      calificadosRescatados = calificados.length;
    }

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
    calificados_rescatados: calificadosRescatados,
    pool_expirado: poolExpirado.count,
  });
}
