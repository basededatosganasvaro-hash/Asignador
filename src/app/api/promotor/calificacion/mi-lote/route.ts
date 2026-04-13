import { NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";

export async function GET() {
  const { session, error } = await requirePromotor();
  if (error) return error;

  const userId = Number(session.user.id);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Buscar lotes activos de hoy (puede haber uno IEPPO y uno CDMX)
  const lotes = await prisma.lotes_calificacion_promotor.findMany({
    where: {
      promotor_id: userId,
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
    orderBy: { created_at: "desc" },
    include: {
      calificaciones: {
        orderBy: { id: "asc" },
        include: { retroalimentacion: true },
      },
    },
  });

  if (lotes.length === 0) {
    return NextResponse.json({ lotes: { IEPPO: null, CDMX: null, PENSIONADOS: null } });
  }

  const resultado: Record<string, unknown> = { IEPPO: null, CDMX: null, PENSIONADOS: null };

  for (const lote of lotes) {
    const clienteIds = lote.calificaciones.map((c) => c.cliente_id);

    let clientesData: Record<number, Record<string, unknown>> = {};

    if (lote.tipo === "IEPPO" && clienteIds.length > 0) {
      // Obtener datos de BD Clientes
      const clientes = await prismaClientes.clientes.findMany({
        where: { id: { in: clienteIds } },
        select: {
          id: true,
          curp: true,
          nombres: true,
          a_paterno: true,
          a_materno: true,
          tel_1: true,
          capacidad: true,
          convenio: true,
          estado: true,
          municipio: true,
          tipo_cliente: true,
          percepciones_fijas: true,
          descuentos_terceros: true,
          filiacion: true,
        },
      });

      // Merge datos_contacto editados
      const datosContacto = await prisma.datos_contacto.findMany({
        where: { cliente_id: { in: clienteIds } },
      });

      const map = new Map(clientes.map((c) => [c.id, { ...c }]));
      for (const dc of datosContacto) {
        if (dc.campo === "id") continue;
        const cliente = map.get(dc.cliente_id);
        if (cliente) {
          (cliente as Record<string, unknown>)[dc.campo] = dc.valor;
        }
      }

      clientesData = Object.fromEntries(map);
    } else if (lote.tipo === "CDMX" && clienteIds.length > 0) {
      // Obtener datos de tabla local clientes_cdmx
      const clientes = await prisma.clientes_cdmx.findMany({
        where: { id: { in: clienteIds } },
      });

      clientesData = Object.fromEntries(
        clientes.map((c) => [
          c.id,
          {
            ...c,
            valor_original: c.valor_original?.toString() ?? null,
            valor_enviado: c.valor_enviado?.toString() ?? null,
            valor_descontado: c.valor_descontado?.toString() ?? null,
          },
        ])
      );
    } else if (lote.tipo === "PENSIONADOS" && clienteIds.length > 0) {
      // Obtener datos de tabla local clientes_pensionados
      const clientes = await prisma.clientes_pensionados.findMany({
        where: { id: { in: clienteIds } },
      });

      clientesData = Object.fromEntries(
        clientes.map((c) => [
          c.id,
          {
            ...c,
            imp_prestamo: c.imp_prestamo?.toString() ?? null,
            imp_mensual: c.imp_mensual?.toString() ?? null,
            imp_saldo_pendiente: c.imp_saldo_pendiente?.toString() ?? null,
            imp_real_prestamo: c.imp_real_prestamo?.toString() ?? null,
            num_tasa_int_anual: c.num_tasa_int_anual?.toString() ?? null,
            cat_prestamo: c.cat_prestamo?.toString() ?? null,
            tasa_efectiva: c.tasa_efectiva?.toString() ?? null,
            tasa_efec_redondeada: c.tasa_efec_redondeada?.toString() ?? null,
          },
        ])
      );
    }

    const items = lote.calificaciones.map((cal) => ({
      id: cal.id,
      cliente_id: cal.cliente_id,
      calificado: cal.calificado,
      telefono: cal.telefono,
      capacidad: cal.capacidad,
      retroalimentacion: cal.retroalimentacion?.nombre ?? null,
      retroalimentacion_id: cal.retroalimentacion_id,
      cliente: clientesData[cal.cliente_id] || null,
    }));

    const totalCalificados = lote.calificaciones.filter((c) => c.calificado).length;

    resultado[lote.tipo] = {
      id: lote.id,
      fecha: lote.fecha,
      tipo: lote.tipo,
      cantidad: lote.cantidad,
      estado: lote.estado,
      total_calificados: totalCalificados,
      total_pendientes: lote.cantidad - totalCalificados,
      items,
    };
  }

  return NextResponse.json({ lotes: resultado });
}
