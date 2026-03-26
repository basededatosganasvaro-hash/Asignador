import { NextResponse } from "next/server";
import { requireSupervisor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const calificarSchema = z.object({
  capacidad_actualizada: z.string().min(1, "La capacidad actualizada es requerida"),
  tel_1: z.string().min(7, "El telefono debe tener al menos 7 digitos").optional(),
  estatus_laboral: z.enum(["Estable", "No estable"], { message: "El estatus es requerido" }),
  fecha_ingreso: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Formato debe ser dd/mm/aaaa").refine((val) => {
    const [dd, mm, yyyy] = val.split("/").map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
  }, "Fecha invalida"),
  no_localizado: z.literal(false).optional(),
});

const noLocalizadoSchema = z.object({
  no_localizado: z.literal(true),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const { id } = await params;
  const calificacionId = parseInt(id);
  if (isNaN(calificacionId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
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

  // Verificar que la calificacion pertenece al supervisor
  const calificacion = await prisma.calificaciones_supervisor.findFirst({
    where: { id: calificacionId, supervisor_id: userId },
    include: { lote: true },
  });

  if (!calificacion) {
    return NextResponse.json({ error: "Calificacion no encontrada" }, { status: 404 });
  }

  if (calificacion.lote.estado === "FINALIZADO") {
    return NextResponse.json({ error: "El lote ya fue finalizado" }, { status: 400 });
  }

  // Obtener equipo_id del supervisor
  const supervisor = await prisma.usuarios.findUnique({
    where: { id: userId },
    select: { equipo_id: true },
  });

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
      await upsertDato("sup_estatus_calificacion", "No localizado");
    } else {
      const { capacidad_actualizada, tel_1, estatus_laboral, fecha_ingreso } = calificarSchema.parse(body);
      await upsertDato("sup_capacidad_actualizada", capacidad_actualizada);
      await upsertDato("sup_estatus_laboral", estatus_laboral);
      await upsertDato("sup_fecha_ingreso", fecha_ingreso);
      await upsertDato("sup_estatus_calificacion", "Localizado");
      if (tel_1) await upsertDato("tel_1", tel_1);

      // Auto-insertar en pool_supervisor (solo si fue calificado, no "no localizado")
      const seisMeses = new Date();
      seisMeses.setMonth(seisMeses.getMonth() + 6);

      await tx.pool_supervisor.upsert({
        where: {
          cliente_id_supervisor_id: {
            cliente_id: calificacion.cliente_id,
            supervisor_id: userId,
          },
        },
        create: {
          cliente_id: calificacion.cliente_id,
          supervisor_id: userId,
          equipo_id: supervisor?.equipo_id ?? null,
          expira_at: seisMeses,
        },
        update: {}, // ya existe, no actualizar
      });
    }

    // Marcar como calificado
    await tx.calificaciones_supervisor.update({
      where: { id: calificacionId },
      data: { calificado: true },
    });

    // Actualizar estado del lote a EN_PROCESO si estaba PENDIENTE
    if (calificacion.lote.estado === "PENDIENTE") {
      await tx.lotes_supervisor.update({
        where: { id: calificacion.lote.id },
        data: { estado: "EN_PROCESO" },
      });
    }

    // Si todos calificados, marcar lote como FINALIZADO
    const pendientes = await tx.calificaciones_supervisor.count({
      where: { lote_id: calificacion.lote.id, calificado: false },
    });
    if (pendientes === 0) {
      await tx.lotes_supervisor.update({
        where: { id: calificacion.lote.id },
        data: { estado: "FINALIZADO" },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
