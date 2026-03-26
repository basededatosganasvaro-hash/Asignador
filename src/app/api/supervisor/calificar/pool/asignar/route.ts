import { NextResponse } from "next/server";
import { requireSupervisor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { calcularTimerVenceConConfig } from "@/lib/horario";
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

  const ahora = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Verificar DENTRO de la transacción para evitar race condition
    // M17: Filtrar expirados para evitar asignar items caducados
    const poolItems = await tx.pool_supervisor.findMany({
      where: {
        id: { in: pool_ids },
        supervisor_id: supervisorId,
        asignado: false,
        expira_at: { gt: ahora },
      },
    });

    if (poolItems.length === 0) {
      return { error: "Los registros ya fueron asignados o no te pertenecen" } as const;
    }

    // Marcar como asignados en pool con WHERE asignado = false para atomicidad
    await tx.pool_supervisor.updateMany({
      where: { id: { in: poolItems.map((p) => p.id) }, asignado: false },
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

    // Calcular timer_vence para que las oportunidades escalen correctamente
    const timerVence = etapaAsignado?.timer_dias
      ? await calcularTimerVenceConConfig(etapaAsignado.timer_dias)
      : null;

    // Crear oportunidades
    await tx.oportunidades.createMany({
      data: poolItems.map((item) => ({
        cliente_id: item.cliente_id,
        usuario_id: promotor_id,
        etapa_id: etapaAsignado?.id ?? null,
        origen: "POOL_SUPERVISOR",
        lote_id: lote.id,
        timer_vence: timerVence,
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

    return { ok: true, asignados: poolItems.length } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    asignados: result.asignados,
    promotor: promotor.nombre,
  });
}
