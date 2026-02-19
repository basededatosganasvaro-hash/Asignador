import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";
import { verificarHorarioConConfig } from "@/lib/horario";
import ExcelJS from "exceljs";

const MAX_REGISTROS_DESCARGA = 500;
const MAX_RANGO_DIAS = 90;

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  // Validar horario operativo
  const horario = await verificarHorarioConConfig();
  if (!horario.activo) {
    return NextResponse.json({ error: horario.mensaje }, { status: 403 });
  }

  const userId = Number(session!.user.id);
  const body = await req.json();
  const { filtros, fecha_desde, fecha_hasta } = body;

  // 1. Validar que al menos 1 filtro esté activo
  if (!filtros || (!filtros.etapa && !filtros.convenio && !filtros.estado && !filtros.tipo_cliente)) {
    return NextResponse.json(
      { error: "Debes aplicar al menos un filtro para descargar" },
      { status: 400 }
    );
  }

  // 2. Validar rango de fechas
  if (!fecha_desde || !fecha_hasta) {
    return NextResponse.json(
      { error: "El rango de fechas es obligatorio" },
      { status: 400 }
    );
  }

  const desde = new Date(fecha_desde);
  const hasta = new Date(fecha_hasta);
  hasta.setHours(23, 59, 59, 999);

  if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }

  if (hasta < desde) {
    return NextResponse.json({ error: "La fecha hasta debe ser posterior a la fecha desde" }, { status: 400 });
  }

  const diffDias = Math.ceil((hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias > MAX_RANGO_DIAS) {
    return NextResponse.json(
      { error: `El rango máximo es de ${MAX_RANGO_DIAS} días` },
      { status: 400 }
    );
  }

  // 3. Construir query
  const where: Record<string, unknown> = {
    usuario_id: userId,
    activo: true,
    created_at: { gte: desde, lte: hasta },
  };

  if (filtros.etapa) {
    where.etapa = { nombre: filtros.etapa };
  }

  // 4. Query oportunidades
  const oportunidades = await prisma.oportunidades.findMany({
    where,
    include: {
      etapa: { select: { nombre: true, color: true } },
      captacion: { select: { convenio: true, datos_json: true } },
    },
    orderBy: { created_at: "asc" },
    take: MAX_REGISTROS_DESCARGA + 1, // +1 para detectar exceso
  });

  if (oportunidades.length > MAX_REGISTROS_DESCARGA) {
    return NextResponse.json(
      { error: `El resultado excede ${MAX_REGISTROS_DESCARGA} registros. Aplica más filtros.` },
      { status: 400 }
    );
  }

  if (oportunidades.length === 0) {
    return NextResponse.json({ error: "No hay registros que coincidan con los filtros" }, { status: 404 });
  }

  // 5. Obtener datos de clientes de BD Clientes
  const clienteIds = oportunidades.map((o) => o.cliente_id).filter((id): id is number => id !== null);
  const clienteMap: Record<number, Record<string, string | null>> = {};

  if (clienteIds.length > 0) {
    const clientes = await prismaClientes.clientes.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, nombres: true, convenio: true, estado: true, municipio: true, tipo_cliente: true, tel_1: true },
    });
    for (const c of clientes) {
      clienteMap[c.id] = c as unknown as Record<string, string | null>;
    }
  }

  // Merge con datos_contacto
  if (clienteIds.length > 0) {
    const ediciones = await prisma.datos_contacto.findMany({
      where: { cliente_id: { in: clienteIds } },
      orderBy: { created_at: "desc" },
    });
    for (const edit of ediciones) {
      if (clienteMap[edit.cliente_id]) {
        const existing = clienteMap[edit.cliente_id][edit.campo];
        if (!existing || existing === null) {
          clienteMap[edit.cliente_id][edit.campo] = edit.valor;
        }
      }
    }
  }

  // Filtros adicionales que requieren datos del cliente
  let rows = oportunidades.map((op) => {
    if (op.cliente_id !== null) {
      const cliente = clienteMap[op.cliente_id] || {};
      return {
        nombres: cliente.nombres ?? "—",
        convenio: cliente.convenio ?? "—",
        estado: cliente.estado ?? "—",
        municipio: cliente.municipio ?? "—",
        tipo_cliente: cliente.tipo_cliente ?? "—",
        tel_1: cliente.tel_1 ?? "",
        etapa: op.etapa?.nombre ?? "—",
        fecha: op.created_at,
      };
    } else {
      const datos = (op.captacion?.datos_json ?? {}) as Record<string, string>;
      return {
        nombres: `${datos.nombres ?? ""} ${datos.a_paterno ?? ""} ${datos.a_materno ?? ""}`.trim() || "Sin nombre",
        convenio: op.captacion?.convenio ?? "—",
        estado: datos.estado ?? "—",
        municipio: datos.municipio ?? "—",
        tipo_cliente: "Captado",
        tel_1: datos.tel_1 ?? "",
        etapa: op.etapa?.nombre ?? "—",
        fecha: op.created_at,
      };
    }
  });

  // Filtros client-side (convenio, estado, tipo_cliente no están en la tabla oportunidades)
  if (filtros.convenio) rows = rows.filter((r) => r.convenio === filtros.convenio);
  if (filtros.estado) rows = rows.filter((r) => r.estado === filtros.estado);
  if (filtros.tipo_cliente) rows = rows.filter((r) => r.tipo_cliente === filtros.tipo_cliente);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No hay registros que coincidan con los filtros" }, { status: 404 });
  }

  // 6. Registrar descarga en historial
  await prisma.historial.create({
    data: {
      oportunidad_id: oportunidades[0].id,
      usuario_id: userId,
      tipo: "DESCARGA",
      nota: `Descarga de ${rows.length} registros (${filtros.etapa || "todas las etapas"}, ${fecha_desde} a ${fecha_hasta})`,
    },
  });

  // 7. Generar Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Oportunidades");

  sheet.columns = [
    { header: "Nombre", key: "nombres", width: 30 },
    { header: "Convenio", key: "convenio", width: 25 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Municipio", key: "municipio", width: 20 },
    { header: "Tipo Cliente", key: "tipo_cliente", width: 15 },
    { header: "Teléfono", key: "tel_1", width: 15 },
    { header: "Etapa", key: "etapa", width: 15 },
    { header: "Fecha", key: "fecha", width: 15 },
  ];

  // Header styling
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A237E" } };
  });

  for (const row of rows) {
    sheet.addRow({
      ...row,
      fecha: new Date(row.fecha).toLocaleDateString("es-MX"),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=oportunidades_${fecha_desde}_${fecha_hasta}.xlsx`,
    },
  });
}
