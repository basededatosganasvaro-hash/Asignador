import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";
import { verificarHorarioConConfig } from "@/lib/horario";
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

  // Validar horario operativo
  const horario = await verificarHorarioConConfig();
  if (!horario.activo) {
    return NextResponse.json({ error: horario.mensaje }, { status: 403 });
  }

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
    // 1. Fecha de hoy en timezone Mexico
    const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());

    // 2. Leer configuracion del límite diario
    const config = await prisma.configuracion.findUnique({
      where: { clave: "max_registros_por_dia" },
    });
    const maxPerDay = parseInt(config?.valor || "300");

    // 3. Verificar cupo antes de hacer trabajo pesado (lectura rápida)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    let yaAsignados = 0;
    let usaCupoDiario = false;
    try {
      const cupoExistente = await prisma.cupo_diario.findUnique({
        where: { usuario_id_fecha: { usuario_id: userId, fecha: today } },
      });
      yaAsignados = cupoExistente?.total_asignado ?? 0;
      usaCupoDiario = true;
    } catch {
      // Fallback: tabla cupo_diario no existe aún, contar desde lotes
      const lotesHoy = await prisma.lotes.findMany({
        where: { usuario_id: userId, fecha: { gte: today, lt: tomorrow } },
        select: { cantidad: true },
      });
      yaAsignados = lotesHoy.reduce((s, l) => s + l.cantidad, 0);
    }
    const cupoDisponible = maxPerDay - yaAsignados;

    if (cupoDisponible <= 0) {
      return NextResponse.json(
        { error: "Has alcanzado el límite diario de asignaciones", cupo_restante: 0 },
        { status: 409 }
      );
    }

    const requested = Math.min(cantidad || cupoDisponible, cupoDisponible);

    // 4. Obtener cliente_ids ya asignados activamente (BD Sistema)
    const activas = await prisma.oportunidades.findMany({
      where: { activo: true },
      select: { cliente_id: true },
    });
    const excludeIds = new Set(
      activas.map((o) => o.cliente_id).filter((id): id is number => id !== null)
    );

    // 4b. Cooldown: excluir clientes que este promotor ya trabajó en los últimos N meses
    const cooldownConfig = await prisma.configuracion.findUnique({
      where: { clave: "cooldown_meses" },
    });
    const cooldownMeses = parseInt(cooldownConfig?.valor || "3");
    const cooldownDate = new Date();
    cooldownDate.setMonth(cooldownDate.getMonth() - cooldownMeses);

    const cooldownOps = await prisma.oportunidades.findMany({
      where: {
        usuario_id: userId,
        cliente_id: { not: null },
        created_at: { gte: cooldownDate },
      },
      select: { cliente_id: true },
    });
    for (const op of cooldownOps) {
      if (op.cliente_id !== null) excludeIds.add(op.cliente_id);
    }

    const excludeArray = Array.from(excludeIds);

    // 5. Construir SQL con parámetros posicionales explícitos ($1, $2, ...)
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (excludeArray.length > 0) {
      const start = params.length + 1;
      const placeholders = excludeArray.map((_, i) => `$${start + i}`).join(", ");
      clauses.push(`id NOT IN (${placeholders})`);
      params.push(...excludeArray);
    }
    if (tipo_cliente) { params.push(tipo_cliente); clauses.push(`tipo_cliente = $${params.length}`); }
    if (convenio)     { params.push(convenio);     clauses.push(`convenio = $${params.length}`); }
    if (estado)       { params.push(estado);       clauses.push(`estado = $${params.length}`); }
    if (municipio)    { params.push(municipio);    clauses.push(`municipio = $${params.length}`); }
    if (tiene_telefono) clauses.push(`tel_1 IS NOT NULL AND TRIM(tel_1) != ''`);

    params.push(requested);
    const limitParam = `$${params.length}`;

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const sql = `SELECT id FROM clientes ${where} ORDER BY id ASC LIMIT ${limitParam}`;

    // 6. Seleccionar clientes del pool en BD Clientes
    const records = await prismaClientes.$queryRawUnsafe<{ id: number }[]>(sql, ...params);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No hay registros disponibles para asignar" },
        { status: 404 }
      );
    }

    // 7. Obtener etapa "Asignado" para inicializar el embudo
    const etapaAsignado = await prisma.embudo_etapas.findFirst({
      where: { nombre: "Asignado", activo: true },
    });
    const timerVence = etapaAsignado?.timer_horas
      ? new Date(Date.now() + etapaAsignado.timer_horas * 60 * 60 * 1000)
      : null;

    // 8. Transacción atómica: crear lote + oportunidades + historial + actualizar cupo
    const registrosFinales = records.slice(0, Math.min(records.length, cupoDisponible));

    const result = await prisma.$transaction(
      async (tx) => {
        // 8a. Verificar cupo con lock (si tabla existe)
        let cupoFinal = cupoDisponible;
        if (usaCupoDiario) {
          await tx.cupo_diario.upsert({
            where: { usuario_id_fecha: { usuario_id: userId, fecha: today } },
            create: { usuario_id: userId, fecha: today, total_asignado: 0, limite: maxPerDay },
            update: {},
          });

          const cupoRows = await tx.$queryRaw<{ id: number; total_asignado: number; limite: number }[]>`
            SELECT id, total_asignado, limite FROM cupo_diario
            WHERE usuario_id = ${userId} AND fecha = ${today}
            FOR UPDATE
          `;

          const cupo = cupoRows[0];
          cupoFinal = cupo.limite - cupo.total_asignado;

          if (cupoFinal <= 0) {
            throw new Error("CUPO_AGOTADO");
          }
        }

        const cantidadReal = Math.min(registrosFinales.length, cupoFinal);
        const registrosReales = registrosFinales.slice(0, cantidadReal);

        // 8b. Crear lote
        const lote = await tx.lotes.create({
          data: {
            usuario_id: userId,
            fecha: today,
            cantidad: registrosReales.length,
          },
        });

        // 8c. Crear oportunidades
        await tx.oportunidades.createMany({
          data: registrosReales.map((r) => ({
            cliente_id: r.id,
            usuario_id: userId,
            etapa_id: etapaAsignado?.id ?? null,
            origen: "POOL",
            lote_id: lote.id,
            timer_vence: timerVence,
            activo: true,
          })),
        });

        // 8d. Crear historial de asignacion
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

        // 8e. Actualizar cupo atómicamente (si tabla existe)
        if (usaCupoDiario) {
          const cupoRows = await tx.$queryRaw<{ id: number; total_asignado: number }[]>`
            SELECT id, total_asignado FROM cupo_diario
            WHERE usuario_id = ${userId} AND fecha = ${today}
          `;
          await tx.cupo_diario.update({
            where: { id: cupoRows[0].id },
            data: { total_asignado: cupoRows[0].total_asignado + registrosReales.length },
          });
        }

        return { lote, cantidadReal: registrosReales.length, cupoRestante: cupoFinal - registrosReales.length };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      }
    );

    return NextResponse.json(
      {
        id: result.lote.id,
        fecha: result.lote.fecha,
        cantidad: result.cantidadReal,
        cupo_restante: result.cupoRestante,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CUPO_AGOTADO") {
      return NextResponse.json(
        { error: "Has alcanzado el límite diario de asignaciones", cupo_restante: 0 },
        { status: 409 }
      );
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Error al crear lote:", errMsg, err);
    return NextResponse.json(
      { error: `Error al crear la asignacion: ${errMsg}` },
      { status: 500 }
    );
  }
}
