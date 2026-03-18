import { NextResponse } from "next/server";
import { requireAnalista } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const calificarSchema = z.object({
  capacidad: z.string().min(1, "La capacidad es requerida"),
  tel_1: z.string().min(7, "El teléfono debe tener al menos 7 dígitos").optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnalista();
  if (error) return error;

  const { id } = await params;
  const calificacionId = parseInt(id);
  if (isNaN(calificacionId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = calificarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const userId = Number(session.user.id);

  // Verificar que la calificación pertenece al analista
  const calificacion = await prisma.calificaciones_analista.findFirst({
    where: { id: calificacionId, analista_id: userId },
    include: { lote: true },
  });

  if (!calificacion) {
    return NextResponse.json({ error: "Calificación no encontrada" }, { status: 404 });
  }

  if (calificacion.lote.estado === "FINALIZADO" || calificacion.lote.estado === "LIMPIADO") {
    return NextResponse.json({ error: "El lote ya fue finalizado" }, { status: 400 });
  }

  // Guardar capacidad y teléfono en datos_contacto (BD Sistema)
  const { capacidad, tel_1 } = parsed.data;

  await prisma.$transaction(async (tx) => {
    // Upsert capacidad
    const existeCap = await tx.datos_contacto.findFirst({
      where: { cliente_id: calificacion.cliente_id, campo: "capacidad" },
    });
    if (existeCap) {
      await tx.datos_contacto.update({
        where: { id: existeCap.id },
        data: { valor: capacidad, editado_por: userId },
      });
    } else {
      await tx.datos_contacto.create({
        data: {
          cliente_id: calificacion.cliente_id,
          campo: "capacidad",
          valor: capacidad,
          editado_por: userId,
        },
      });
    }

    // Upsert teléfono si se proporcionó
    if (tel_1) {
      const existeTel = await tx.datos_contacto.findFirst({
        where: { cliente_id: calificacion.cliente_id, campo: "tel_1" },
      });
      if (existeTel) {
        await tx.datos_contacto.update({
          where: { id: existeTel.id },
          data: { valor: tel_1, editado_por: userId },
        });
      } else {
        await tx.datos_contacto.create({
          data: {
            cliente_id: calificacion.cliente_id,
            campo: "tel_1",
            valor: tel_1,
            editado_por: userId,
          },
        });
      }
    }

    // Marcar como calificado
    await tx.calificaciones_analista.update({
      where: { id: calificacionId },
      data: { calificado: true },
    });

    // Actualizar estado del lote a EN_PROCESO si estaba PENDIENTE
    if (calificacion.lote.estado === "PENDIENTE") {
      await tx.lotes_analista.update({
        where: { id: calificacion.lote.id },
        data: { estado: "EN_PROCESO" },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
