import { NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const liberarSchema = z.object({
  lote_id: z.number().int().positive(),
});

export async function POST(req: Request) {
  const { session, error } = await requirePromotor();
  if (error) return error;

  const body = await req.json();
  const parsed = liberarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const { lote_id } = parsed.data;
  const userId = Number(session.user.id);

  // Verificar que el lote pertenece al promotor y esta activo
  const lote = await prisma.lotes_calificacion_promotor.findFirst({
    where: {
      id: lote_id,
      promotor_id: userId,
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
    include: {
      calificaciones: true,
    },
  });

  if (!lote) {
    return NextResponse.json({ error: "No se encontro lote activo" }, { status: 404 });
  }

  const calificados = lote.calificaciones.filter((c) => c.calificado).length;
  const pendientes = lote.calificaciones.filter((c) => !c.calificado).length;

  await prisma.$transaction(async (tx) => {
    // Eliminar calificaciones no completadas para liberar esos cliente_ids
    await tx.calificaciones_promotor.deleteMany({
      where: {
        lote_id: lote.id,
        calificado: false,
      },
    });

    // Marcar lote como DEVUELTO
    await tx.lotes_calificacion_promotor.update({
      where: { id: lote.id },
      data: {
        estado: "DEVUELTO",
        cantidad: calificados,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    calificados,
    liberados: pendientes,
  });
}
