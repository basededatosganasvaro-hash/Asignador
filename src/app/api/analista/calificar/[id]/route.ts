import { NextResponse } from "next/server";
import { requireAnalista } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const calificarSchema = z.object({
  capacidad: z.string().min(1, "La capacidad es requerida"),
  tel_1: z.string().min(7, "El teléfono debe tener al menos 7 dígitos").optional(),
  filiacion: z.string().optional(),
  estatus_laboral: z.enum(["Estable", "No estable"], { message: "El estatus es requerido" }),
  fecha_ingreso: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Formato debe ser dd/mm/aaaa").refine((val) => {
    const [dd, mm, yyyy] = val.split("/").map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
  }, "Fecha inválida"),
  no_localizado: z.literal(false).optional(),
});

const noLocalizadoSchema = z.object({
  no_localizado: z.literal(true),
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
  const esNoLocalizado = noLocalizadoSchema.safeParse(body).success;

  if (!esNoLocalizado) {
    const parsed = calificarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
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

  await prisma.$transaction(async (tx) => {
    // Helper upsert datos_contacto
    const upsertDato = async (campo: string, valor: string) => {
      const existe = await tx.datos_contacto.findFirst({
        where: { cliente_id: calificacion.cliente_id, campo },
      });
      if (existe) {
        await tx.datos_contacto.update({
          where: { id: existe.id },
          data: { valor, editado_por: userId },
        });
      } else {
        await tx.datos_contacto.create({
          data: { cliente_id: calificacion.cliente_id, campo, valor, editado_por: userId },
        });
      }
    };

    if (esNoLocalizado) {
      await upsertDato("estatus_calificacion", "No localizado");
    } else {
      const { capacidad, tel_1, filiacion, estatus_laboral, fecha_ingreso } = calificarSchema.parse(body);
      await upsertDato("capacidad", capacidad);
      await upsertDato("estatus_laboral", estatus_laboral);
      await upsertDato("fecha_ingreso", fecha_ingreso);
      await upsertDato("estatus_calificacion", "Localizado");
      if (tel_1) await upsertDato("tel_1", tel_1);
      if (filiacion) await upsertDato("filiacion", filiacion);
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
