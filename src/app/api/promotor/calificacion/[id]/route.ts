import { NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const calificarSchema = z.object({
  telefono: z.string().min(7, "Mínimo 7 dígitos").optional().or(z.literal("")),
  capacidad: z.string().min(1, "Capacidad requerida"),
  retroalimentacion_id: z.number().int().positive("Selecciona retroalimentación"),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePromotor();
  if (error) return error;

  const { id } = await params;
  const calificacionId = Number(id);
  if (isNaN(calificacionId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = calificarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { telefono, capacidad, retroalimentacion_id } = parsed.data;
  const userId = Number(session.user.id);

  // Verificar que el promotor es dueño del registro
  const calificacion = await prisma.calificaciones_promotor.findUnique({
    where: { id: calificacionId },
    include: { lote: true },
  });

  if (!calificacion || calificacion.promotor_id !== userId) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  if (calificacion.lote.estado === "DEVUELTO") {
    return NextResponse.json({ error: "El lote ya fue devuelto" }, { status: 400 });
  }

  // Verificar que la retroalimentación existe
  const retro = await prisma.catalogo_retroalimentacion.findUnique({
    where: { id: retroalimentacion_id },
  });
  if (!retro || !retro.activo) {
    return NextResponse.json({ error: "Retroalimentación inválida" }, { status: 400 });
  }

  // Actualizar calificación
  await prisma.$transaction(async (tx) => {
    await tx.calificaciones_promotor.update({
      where: { id: calificacionId },
      data: {
        calificado: true,
        telefono: telefono || null,
        capacidad,
        retroalimentacion_id,
      },
    });

    // Cambiar estado del lote a EN_PROCESO si estaba PENDIENTE
    if (calificacion.lote.estado === "PENDIENTE") {
      await tx.lotes_calificacion_promotor.update({
        where: { id: calificacion.lote_id },
        data: { estado: "EN_PROCESO" },
      });
    }
  });

  return NextResponse.json({ ok: true, mensaje: "Registro calificado" });
}
