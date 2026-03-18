import { NextResponse } from "next/server";
import { requireAnalista } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const { session, error } = await requireAnalista();
  if (error) return error;

  const userId = Number(session.user.id);

  // Buscar lote activo del analista
  const lote = await prisma.lotes_analista.findFirst({
    where: {
      analista_id: userId,
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
    include: {
      calificaciones: true,
    },
    orderBy: { fecha: "desc" },
  });

  if (!lote) {
    return NextResponse.json({ error: "No tienes lote activo" }, { status: 400 });
  }

  const calificados = lote.calificaciones.filter((c) => c.calificado);

  const pendientes = lote.calificaciones.filter((c) => !c.calificado);
  if (pendientes.length > 0) {
    return NextResponse.json(
      { error: `Faltan ${pendientes.length} registros por calificar` },
      { status: 400 }
    );
  }

  // Obtener region_id del analista para scope del gerente
  const analista = await prisma.usuarios.findUnique({
    where: { id: userId },
    select: { region_id: true },
  });

  const seisMeses = new Date();
  seisMeses.setMonth(seisMeses.getMonth() + 6);

  await prisma.$transaction(async (tx) => {
    // Mover calificados al pool del gerente
    await tx.pool_gerente.createMany({
      data: calificados.map((c) => ({
        cliente_id: c.cliente_id,
        calificado_por: userId,
        region_id: analista?.region_id ?? null,
        expira_at: seisMeses,
      })),
      skipDuplicates: true,
    });

    // Eliminar calificaciones no completadas
    await tx.calificaciones_analista.deleteMany({
      where: {
        lote_id: lote.id,
        calificado: false,
      },
    });

    // Marcar lote como FINALIZADO
    await tx.lotes_analista.update({
      where: { id: lote.id },
      data: {
        estado: "FINALIZADO",
        finalizado_at: new Date(),
      },
    });
  });

  return NextResponse.json({
    ok: true,
    calificados: calificados.length,
    descartados: lote.calificaciones.length - calificados.length,
  });
}
