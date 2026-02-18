import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";
import { Prisma } from "@prisma/client";

// GET: Listar lotes del usuario autenticado
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = parseInt(session.user.id);

  const lotes = await prisma.lotes.findMany({
    where: { usuario_id: userId },
    include: {
      oportunidades: {
        where: { activo: true },
        select: { cliente_id: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  // Para cada lote, obtener cuantos clientes tienen tel_1 en datos_contacto o en clientes original
  const result = await Promise.all(
    lotes.map(async (lote) => {
      const clienteIds = lote.oportunidades.map((o) => o.cliente_id).filter((id): id is number => id !== null);
      const cantidad = clienteIds.length;

      if (cantidad === 0) {
        return {
          id: lote.id,
          fecha: lote.fecha,
          cantidad: lote.cantidad,
          oportunidades_activas: 0,
          registros_con_tel1: 0,
          puede_descargar: false,
        };
      }

      // Ediciones de tel_1 en BD Sistema
      const ediciones = await prisma.datos_contacto.findMany({
        where: { cliente_id: { in: clienteIds }, campo: "tel_1" },
        orderBy: { created_at: "desc" },
      });
      const tel1Editados = new Set(ediciones.map((e) => e.cliente_id));

      // Clientes con tel_1 original en BD Clientes (los que no tienen edicion)
      const sinEdicion = clienteIds.filter((id) => !tel1Editados.has(id));
      let conTel1Original = 0;
      if (sinEdicion.length > 0) {
        conTel1Original = await prismaClientes.clientes.count({
          where: {
            id: { in: sinEdicion },
            tel_1: { not: null },
          },
        });
      }

      const registros_con_tel1 = tel1Editados.size + conTel1Original;

      return {
        id: lote.id,
        fecha: lote.fecha,
        cantidad: lote.cantidad,
        oportunidades_activas: cantidad,
        registros_con_tel1,
        puede_descargar: registros_con_tel1 === cantidad && cantidad > 0,
      };
    })
  );

  return NextResponse.json(result);
}

// POST: Solicitar nuevo lote de asignacion
export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = parseInt(session.user.id);

  let cantidad: number | undefined;
  let tipo_cliente: string | undefined;
  let convenio: string | undefined;
  let estado: string | undefined;
  let municipio: string | undefined;
  let tiene_telefono: boolean | undefined;

  try {
    const body = await request.json();
    cantidad = body.cantidad;
    tipo_cliente = body.tipo_cliente || undefined;
    convenio = body.convenio || undefined;
    estado = body.estado || undefined;
    municipio = body.municipio || undefined;
    tiene_telefono = body.tiene_telefono || false;
  } catch {
    // Sin body: usar el maximo disponible sin filtros
  }

  try {
    // 1. Leer configuracion y calcular cupo restante (BD Sistema)
    const config = await prisma.configuracion.findUnique({
      where: { clave: "max_registros_por_dia" },
    });
    const maxPerDay = parseInt(config?.valor || "300");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lotesHoy = await prisma.lotes.findMany({
      where: { usuario_id: userId, fecha: { gte: today, lt: tomorrow } },
      select: { cantidad: true },
    });

    const asignadosHoy = lotesHoy.reduce((sum, l) => sum + l.cantidad, 0);
    const remaining = maxPerDay - asignadosHoy;

    if (remaining <= 0) {
      return NextResponse.json(
        { error: "Has alcanzado el limite diario de asignaciones" },
        { status: 409 }
      );
    }

    const requested = Math.min(cantidad || remaining, remaining);

    // 2. Obtener cliente_ids ya asignados activamente (BD Sistema)
    const activas = await prisma.oportunidades.findMany({
      where: { activo: true },
      select: { cliente_id: true },
    });
    const excludeIds = activas.map((o) => o.cliente_id).filter((id): id is number => id !== null);

    // 3. Construir condiciones para el filtro
    const conditions: Prisma.Sql[] = [];
    if (excludeIds.length > 0) {
      conditions.push(Prisma.sql`id NOT IN (${Prisma.join(excludeIds)})`);
    }
    if (tipo_cliente) conditions.push(Prisma.sql`tipo_cliente = ${tipo_cliente}`);
    if (convenio) conditions.push(Prisma.sql`convenio = ${convenio}`);
    if (estado) conditions.push(Prisma.sql`estado = ${estado}`);
    if (municipio) conditions.push(Prisma.sql`municipio = ${municipio}`);
    if (tiene_telefono) conditions.push(Prisma.sql`tel_1 IS NOT NULL AND TRIM(tel_1) != ''`);

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;

    // 4. Seleccionar clientes del pool en BD Clientes (con lock para concurrencia)
    const records = await prismaClientes.$queryRaw<{ id: number }[]>`
      SELECT id FROM clientes
      ${whereClause}
      ORDER BY id ASC
      LIMIT ${requested}
      FOR UPDATE SKIP LOCKED
    `;

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No hay registros disponibles para asignar" },
        { status: 404 }
      );
    }

    // 4. Obtener etapa "Asignado" para inicializar el embudo
    const etapaAsignado = await prisma.embudo_etapas.findFirst({
      where: { nombre: "Asignado", activo: true },
    });
    const timerVence = etapaAsignado?.timer_horas
      ? new Date(Date.now() + etapaAsignado.timer_horas * 60 * 60 * 1000)
      : null;

    // 5. Crear lote + oportunidades en BD Sistema (transaccion)
    const result = await prisma.$transaction(
      async (tx) => {
        const lote = await tx.lotes.create({
          data: {
            usuario_id: userId,
            fecha: today,
            cantidad: records.length,
          },
        });

        await tx.oportunidades.createMany({
          data: records.map((r) => ({
            cliente_id: r.id,
            usuario_id: userId,
            etapa_id: etapaAsignado?.id ?? null,
            origen: "POOL",
            lote_id: lote.id,
            timer_vence: timerVence,
            activo: true,
          })),
        });

        // Crear historial de asignacion para cada oportunidad
        const oportunidadesCreadas = await tx.oportunidades.findMany({
          where: { lote_id: lote.id },
          select: { id: true },
        });
        await tx.historial.createMany({
          data: oportunidadesCreadas.map((op) => ({
            oportunidad_id: op.id,
            usuario_id: userId,
            tipo: "ASIGNACION",
            etapa_nueva_id: etapaAsignado?.id ?? null,
            nota: "Asignacion desde pool",
          })),
        });

        return lote;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      }
    );

    return NextResponse.json(
      { id: result.id, fecha: result.fecha, cantidad: records.length },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("Error al crear lote:", err);
    return NextResponse.json(
      { error: "Error al crear la asignacion" },
      { status: 500 }
    );
  }
}
