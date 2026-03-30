import { NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { z } from "zod";

const solicitarSchema = z.object({
  tipo: z.enum(["IEPPO", "CDMX"]),
  cantidad: z.number().int().min(1).max(300),
});

export async function POST(req: Request) {
  const { session, error } = await requirePromotor();
  if (error) return error;

  const body = await req.json();
  const parsed = solicitarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { tipo, cantidad } = parsed.data;
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

  const cantidadReal = Math.min(cantidad, disponible);

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

  // Buscar registros no asignados en la ronda actual
  let clienteIds: number[] = [];

  if (tipo === "IEPPO") {
    clienteIds = await obtenerIdsIEPPO(ronda.ronda_actual, cantidadReal);
  } else {
    clienteIds = await obtenerIdsCDMX(ronda.ronda_actual, cantidadReal);
  }

  // Si no hay registros disponibles, incrementar ronda y reintentar
  if (clienteIds.length === 0) {
    const nuevaRonda = ronda.ronda_actual + 1;
    await prisma.rondas_calificacion.update({
      where: { tipo },
      data: { ronda_actual: nuevaRonda },
    });

    if (tipo === "IEPPO") {
      clienteIds = await obtenerIdsIEPPO(nuevaRonda, cantidadReal);
    } else {
      clienteIds = await obtenerIdsCDMX(nuevaRonda, cantidadReal);
    }

    if (clienteIds.length === 0) {
      return NextResponse.json({ error: "No hay registros disponibles para asignar" }, { status: 400 });
    }
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

async function obtenerIdsIEPPO(ronda: number, cantidad: number): Promise<number[]> {
  // IDs ya asignados en esta ronda
  const asignados = await prisma.calificaciones_promotor.findMany({
    where: { tipo: "IEPPO", ronda },
    select: { cliente_id: true },
  });
  const idsAsignados = asignados.map((a) => a.cliente_id);

  // Buscar clientes IEPPO en BD Clientes que no estén asignados
  const clientes = await prismaClientes.clientes.findMany({
    where: {
      tipo_cliente: "Cartera para calificar IEPPO",
      ...(idsAsignados.length > 0 ? { id: { notIn: idsAsignados } } : {}),
    },
    select: { id: true },
    take: cantidad,
    orderBy: { id: "asc" },
  });

  return clientes.map((c) => c.id);
}

async function obtenerIdsCDMX(ronda: number, cantidad: number): Promise<number[]> {
  // IDs ya asignados en esta ronda
  const asignados = await prisma.calificaciones_promotor.findMany({
    where: { tipo: "CDMX", ronda },
    select: { cliente_id: true },
  });
  const idsAsignados = asignados.map((a) => a.cliente_id);

  // Buscar clientes CDMX en tabla local que no estén asignados
  const clientes = await prisma.clientes_cdmx.findMany({
    where: {
      ...(idsAsignados.length > 0 ? { id: { notIn: idsAsignados } } : {}),
    },
    select: { id: true },
    take: cantidad,
    orderBy: { id: "asc" },
  });

  return clientes.map((c) => c.id);
}
