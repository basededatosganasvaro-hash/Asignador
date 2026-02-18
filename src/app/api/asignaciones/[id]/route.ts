import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const loteId = parseInt(id);
  const userId = parseInt(session.user.id);

  // 1. Obtener lote con oportunidades activas (BD Sistema)
  const lote = await prisma.lotes.findUnique({
    where: { id: loteId },
    include: {
      oportunidades: {
        where: { activo: true },
        select: { id: true, cliente_id: true },
      },
    },
  });

  if (!lote) {
    return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  }

  if (lote.usuario_id !== userId && session.user.rol !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const clienteIds = lote.oportunidades.map((o) => o.cliente_id).filter((id): id is number => id !== null);

  if (clienteIds.length === 0) {
    return NextResponse.json({
      id: lote.id,
      fecha: lote.fecha,
      cantidad: lote.cantidad,
      oportunidades_activas: 0,
      registros_con_tel1: 0,
      puede_descargar: false,
      registros: [],
    });
  }

  // 2. Obtener datos originales de BD Clientes
  const clientes = await prismaClientes.clientes.findMany({
    where: { id: { in: clienteIds } },
    select: {
      id: true,
      nombres: true,
      tel_1: true,
      tel_2: true,
      tel_3: true,
      tel_4: true,
      tel_5: true,
      curp: true,
      rfc: true,
      num_empleado: true,
      estado: true,
      municipio: true,
      convenio: true,
      oferta: true,
    },
  });

  // 3. Obtener ediciones de BD Sistema (ultimo valor por campo por cliente)
  const ediciones = await prisma.datos_contacto.findMany({
    where: { cliente_id: { in: clienteIds } },
    orderBy: { created_at: "asc" },
  });

  // Agrupar ediciones: { cliente_id -> { campo -> valor } }
  const edicionesMap = new Map<number, Record<string, string>>();
  for (const e of ediciones) {
    if (!edicionesMap.has(e.cliente_id)) {
      edicionesMap.set(e.cliente_id, {});
    }
    edicionesMap.get(e.cliente_id)![e.campo] = e.valor;
  }

  // 4. Merge: datos originales + ediciones
  const registros = clientes.map((c) => {
    const edits = edicionesMap.get(c.id) ?? {};
    return {
      id: c.id,
      nombres: c.nombres,
      tel_1: edits.tel_1 ?? c.tel_1,
      tel_2: c.tel_2,
      tel_3: c.tel_3,
      tel_4: c.tel_4,
      tel_5: c.tel_5,
      curp: edits.curp ?? c.curp,
      rfc: edits.rfc ?? c.rfc,
      num_empleado: edits.num_empleado ?? c.num_empleado,
      estado: c.estado,
      municipio: c.municipio,
      convenio: c.convenio,
      oferta: c.oferta,
    };
  });

  const registrosConTel1 = registros.filter(
    (c) => c.tel_1 && c.tel_1.trim() !== ""
  ).length;

  return NextResponse.json({
    id: lote.id,
    fecha: lote.fecha,
    cantidad: lote.cantidad,
    oportunidades_activas: clienteIds.length,
    registros_con_tel1: registrosConTel1,
    puede_descargar: registrosConTel1 === clienteIds.length && clienteIds.length > 0,
    registros,
  });
}
