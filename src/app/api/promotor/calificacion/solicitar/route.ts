import { NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { z } from "zod";

const solicitarSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("IEPPO"),
    cliente_ids: z.array(z.number().int().positive()).min(1).max(300),
  }),
  z.object({
    tipo: z.literal("CDMX"),
    cliente_ids: z.array(z.number().int().positive()).min(1).max(300),
  }),
]);

export async function POST(req: Request) {
  const { session, error } = await requirePromotor();
  if (error) return error;

  const body = await req.json();
  const parsed = solicitarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { tipo } = parsed.data;
  const userId = Number(session.user.id);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Verificar cupo disponible
  const cupo = await prisma.cupo_calificacion_diario.upsert({
    where: { usuario_id_fecha: { usuario_id: userId, fecha: hoy } },
    update: {},
    create: { usuario_id: userId, fecha: hoy, total_asignado: 0, limite: 300 },
  });

  const disponible = cupo.limite - cupo.total_asignado;
  if (disponible <= 0) {
    return NextResponse.json({ error: "Cupo diario agotado" }, { status: 400 });
  }

  // Verificar que no tenga un lote activo del mismo tipo hoy
  const loteExistente = await prisma.lotes_calificacion_promotor.findFirst({
    where: {
      promotor_id: userId,
      fecha: hoy,
      tipo,
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
  });

  if (loteExistente) {
    return NextResponse.json({ error: `Ya tienes un lote ${tipo} activo hoy` }, { status: 400 });
  }

  // Obtener ronda actual
  let ronda = await prisma.rondas_calificacion.findUnique({ where: { tipo } });
  if (!ronda) {
    ronda = await prisma.rondas_calificacion.create({ data: { tipo, ronda_actual: 1 } });
  }

  let clienteIds: number[] = [];

  const requestedIds = parsed.data.cliente_ids;
  const cantidadReal = Math.min(requestedIds.length, disponible);
  const idsToUse = requestedIds.slice(0, cantidadReal);

  if (tipo === "CDMX") {
    // Validar que los IDs existen en clientes_cdmx
    const existentes = await prisma.clientes_cdmx.findMany({
      where: { id: { in: idsToUse } },
      select: { id: true },
    });
    const existentesSet = new Set(existentes.map((c) => c.id));

    // Filtrar ya asignados en esta ronda
    const yaAsignados = await prisma.calificaciones_promotor.findMany({
      where: { tipo: "CDMX", ronda: ronda.ronda_actual, cliente_id: { in: idsToUse } },
      select: { cliente_id: true },
    });
    const yaAsignadosSet = new Set(yaAsignados.map((a) => a.cliente_id));

    clienteIds = idsToUse.filter((id) => existentesSet.has(id) && !yaAsignadosSet.has(id));
  } else {
    // IEPPO: validar que los IDs existen en BD Clientes
    const existentes = await prismaClientes.clientes.findMany({
      where: { id: { in: idsToUse }, tipo_cliente: "Cartera para calificar IEPPO" },
      select: { id: true },
    });
    const existentesSet = new Set(existentes.map((c) => c.id));

    // Filtrar ya asignados en esta ronda
    const yaAsignados = await prisma.calificaciones_promotor.findMany({
      where: { tipo: "IEPPO", ronda: ronda.ronda_actual, cliente_id: { in: idsToUse } },
      select: { cliente_id: true },
    });
    const yaAsignadosSet = new Set(yaAsignados.map((a) => a.cliente_id));

    clienteIds = idsToUse.filter((id) => existentesSet.has(id) && !yaAsignadosSet.has(id));
  }

  if (clienteIds.length === 0) {
    return NextResponse.json({ error: "Ninguno de los clientes seleccionados está disponible" }, { status: 400 });
  }

  // Crear lote + calificaciones en transacción
  const resultado = await prisma.$transaction(async (tx) => {
    const lote = await tx.lotes_calificacion_promotor.create({
      data: {
        promotor_id: userId,
        fecha: hoy,
        tipo,
        cantidad: clienteIds.length,
        estado: "PENDIENTE",
      },
    });

    await tx.calificaciones_promotor.createMany({
      data: clienteIds.map((clienteId) => ({
        lote_id: lote.id,
        promotor_id: userId,
        cliente_id: clienteId,
        tipo,
        ronda: ronda!.ronda_actual,
      })),
    });

    // Actualizar cupo
    await tx.cupo_calificacion_diario.update({
      where: { usuario_id_fecha: { usuario_id: userId, fecha: hoy } },
      data: { total_asignado: { increment: clienteIds.length } },
    });

    return lote;
  });

  return NextResponse.json({
    lote_id: resultado.id,
    cantidad: clienteIds.length,
    tipo,
    mensaje: `Se asignaron ${clienteIds.length} registros ${tipo}`,
  });
}


