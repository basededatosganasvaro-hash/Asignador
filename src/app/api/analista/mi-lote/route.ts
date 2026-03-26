import { NextResponse } from "next/server";
import { requireAnalista } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";

export async function GET() {
  const { session, error } = await requireAnalista();
  if (error) return error;

  const userId = session.user.id;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Buscar lote de hoy (o el más reciente activo)
  const lote = await prisma.lotes_analista.findFirst({
    where: {
      analista_id: Number(userId),
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
    orderBy: { fecha: "desc" },
    include: {
      calificaciones: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!lote) {
    return NextResponse.json({ lote: null, clientes: [] });
  }

  // Obtener datos de clientes desde BD Clientes
  const clienteIds = lote.calificaciones.map((c) => c.cliente_id);

  const clientes = clienteIds.length > 0
    ? await prismaClientes.clientes.findMany({
        where: { id: { in: clienteIds } },
        select: {
          id: true,
          curp: true,
          nombres: true,
          a_paterno: true,
          a_materno: true,
          tel_1: true,
          capacidad: true,
          percepciones_fijas: true,
          descuentos_terceros: true,
          filiacion: true,
        },
      })
    : [];

  // Obtener datos_contacto editados para estos clientes
  const datosContacto = clienteIds.length > 0
    ? await prisma.datos_contacto.findMany({
        where: { cliente_id: { in: clienteIds } },
      })
    : [];

  // Merge: datos_contacto encima de datos originales (filter out 'id' to avoid overwriting PK)
  const clientesMap = new Map(clientes.map((c) => [c.id, { ...c }]));
  for (const dc of datosContacto) {
    if (dc.campo === "id") continue; // never overwrite client PK
    const cliente = clientesMap.get(dc.cliente_id);
    if (cliente) {
      (cliente as Record<string, unknown>)[dc.campo] = dc.valor;
    }
  }

  // Combinar calificaciones con datos de cliente
  const items = lote.calificaciones.map((cal) => {
    const cliente = clientesMap.get(cal.cliente_id);
    return {
      id: cal.id,
      cliente_id: cal.cliente_id,
      calificado: cal.calificado,
      recalificar: cal.recalificar,
      cliente: cliente || null,
    };
  });

  const totalCalificados = lote.calificaciones.filter((c) => c.calificado).length;

  return NextResponse.json({
    lote: {
      id: lote.id,
      fecha: lote.fecha,
      cantidad: lote.cantidad,
      estado: lote.estado,
      total_calificados: totalCalificados,
      total_pendientes: lote.cantidad - totalCalificados,
    },
    clientes: items,
  });
}
