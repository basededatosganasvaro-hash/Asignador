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

  // No permitir liberar si hay registros sin calificar
  const pendientes = lote.calificaciones.filter((c) => !c.calificado).length;
  if (pendientes > 0) {
    return NextResponse.json(
      { error: `Faltan ${pendientes} registros por calificar` },
      { status: 400 }
    );
  }

  // Marcar lote como DEVUELTO — las calificaciones se conservan como historico
  await prisma.lotes_calificacion_promotor.update({
    where: { id: lote.id },
    data: { estado: "DEVUELTO" },
  });

  return NextResponse.json({
    ok: true,
    calificados: lote.calificaciones.length,
  });
}
