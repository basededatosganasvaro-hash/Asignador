import { NextResponse } from "next/server";
import { requireSupervisor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const asignarSchema = z.object({
  pool_ids: z.array(z.number().int().positive()).min(1, "Selecciona al menos un registro"),
  promotor_id: z.number().int().positive("Selecciona un promotor"),
});

export async function POST(req: Request) {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const body = await req.json();
  const parsed = asignarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { pool_ids, promotor_id } = parsed.data;
  const supervisorId = Number(session.user.id);

  // Verificar equipo del supervisor
  const supervisor = await prisma.usuarios.findUnique({
    where: { id: supervisorId },
    select: { equipo_id: true },
  });

  if (!supervisor?.equipo_id) {
    return NextResponse.json({ error: "No tienes equipo asignado" }, { status: 400 });
  }

  // Verificar promotor pertenece al equipo
  const promotor = await prisma.usuarios.findFirst({
    where: { id: promotor_id, rol: "promotor", activo: true, equipo_id: supervisor.equipo_id },
    select: { id: true, nombre: true },
  });

  if (!promotor) {
    return NextResponse.json({ error: "Promotor no encontrado o no pertenece a tu equipo" }, { status: 400 });
  }

  // Verificar que los pool_ids pertenecen al supervisor y no estan asignados
  const poolItems = await prisma.pool_supervisor.findMany({
    where: {
      id: { in: pool_ids },
      supervisor_id: supervisorId,
      asignado: false,
    },
  });

  if (poolItems.length === 0) {
    return NextResponse.json({ error: "Los registros ya fueron asignados o no te pertenecen" }, { status: 400 });
  }

  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    // Marcar como asignados en pool
    await tx.pool_supervisor.updateMany({
      where: { id: { in: poolItems.map((p) => p.id) } },
      data: {
        asignado: true,
        asignado_a: promotor_id,
        asignado_at: ahora,
      },
    });

    // Crear lote para el promotor
    const lote = await tx.lotes.create({
      data: {
        usuario_id: promotor_id,
        fecha: ahora,
        cantidad: poolItems.length,
      },
    });

    // Obtener etapa "Asignado"
    const etapaAsignado = await tx.embudo_etapas.findFirst({
      where: { nombre: "Asignado", activo: true },
    });

    // Crear oportunidades
    await tx.oportunidades.createMany({
      data: poolItems.map((item) => ({
        cliente_id: item.cliente_id,
        usuario_id: promotor_id,
        etapa_id: etapaAsignado?.id ?? null,
        origen: "POOL_SUPERVISOR",
        lote_id: lote.id,
        activo: true,
      })),
    });

    // Historial
    const oportunidadesCreadas = await tx.oportunidades.findMany({
      where: { lote_id: lote.id },
      select: { id: true },
    });
    await tx.historial.createMany({
      data: oportunidadesCreadas.map((op) => ({
        oportunidad_id: op.id,
        usuario_id: supervisorId,
        tipo: "ASIGNACION",
        etapa_nueva_id: etapaAsignado?.id ?? null,
        nota: `Asignacion desde pool calificado por supervisor`,
      })),
    });
  });

  return NextResponse.json({
    ok: true,
    asignados: poolItems.length,
    promotor: promotor.nombre,
  });
}
