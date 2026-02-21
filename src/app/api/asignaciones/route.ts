import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";
import { verificarHorarioConConfig, calcularTimerVenceConConfig } from "@/lib/horario";
import { getConfig } from "@/lib/config-cache";
import { Prisma } from "@prisma/client";

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isSerializationError =
        err instanceof Error && err.message.includes("could not serialize");
      if (!isSerializationError || i === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 100 * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}

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

  // Batch: collect all clienteIds across all lotes
  const allClienteIds = lotes.flatMap((l) =>
    l.oportunidades.map((o) => o.cliente_id).filter((id): id is number => id !== null)
  );
  const uniqueClienteIds = [...new Set(allClienteIds)];

  // Two batch queries in parallel instead of 2×N per-lote queries
  const [allEdiciones, clientesConTel1] = await Promise.all([
    uniqueClienteIds.length > 0
      ? prisma.datos_contacto.findMany({
          where: { cliente_id: { in: uniqueClienteIds }, campo: "tel_1" },
          orderBy: { created_at: "desc" },
        })
      : [],
    uniqueClienteIds.length > 0
      ? prismaClientes.clientes.findMany({
          where: { id: { in: uniqueClienteIds }, tel_1: { not: null } },
          select: { id: true },
        })
      : [],
  ]);

  // Build lookup sets
  const tel1EditadosSet = new Set(allEdiciones.map((e) => e.cliente_id));
  const clientesConTel1Set = new Set(clientesConTel1.map((c) => c.id));

  // Map without additional queries
  const result = lotes.map((lote) => {
    const clienteIds = lote.oportunidades
      .map((o) => o.cliente_id)
      .filter((id): id is number => id !== null);
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

    // Count: clients with tel_1 edited + clients with original tel_1 (not edited)
    let registros_con_tel1 = 0;
    for (const cid of clienteIds) {
      if (tel1EditadosSet.has(cid) || clientesConTel1Set.has(cid)) {
        registros_con_tel1++;
      }
    }

    return {
      id: lote.id,
      fecha: lote.fecha,
      cantidad: lote.cantidad,
      oportunidades_activas: cantidad,
      registros_con_tel1,
      puede_descargar: registros_con_tel1 === cantidad && cantidad > 0,
    };
  });

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
    cantidad = body.cantidad != null ? Math.floor(Number(body.cantidad)) : undefined;
    if (cantidad != null && (!Number.isFinite(cantidad) || cantidad < 1)) {
      return NextResponse.json({ error: "Cantidad debe ser un número entero positivo" }, { status: 400 });
    }
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

    // 2. Leer configuracion del límite diario (cached)
    const maxPerDayStr = await getConfig("max_registros_por_dia");
    const maxPerDay = parseInt(maxPerDayStr || "300");

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

    // 4. Obtener cliente_ids a excluir en una sola query SQL (activos + cooldown)
    const cooldownStr = await getConfig("cooldown_meses");
    const cooldownMeses = parseInt(cooldownStr || "3");
    const cooldownDate = new Date();
    cooldownDate.setMonth(cooldownDate.getMonth() - cooldownMeses);

    const excludeRows = await prisma.$queryRaw<{ cliente_id: number }[]>`
      SELECT DISTINCT cliente_id FROM oportunidades
      WHERE cliente_id IS NOT NULL
        AND (activo = true OR (usuario_id = ${userId} AND created_at >= ${cooldownDate}))
    `;
    const excludeArray = excludeRows.map((r) => r.cliente_id);

    // 5. Construir SQL con parámetros posicionales explícitos ($1, $2, ...)
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (excludeArray.length > 0) {
      params.push(excludeArray);
      clauses.push(`id != ALL($${params.length})`);
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
      ? await calcularTimerVenceConConfig(etapaAsignado.timer_horas)
      : null;

    // 8. Transacción atómica: crear lote + oportunidades + historial + actualizar cupo
    const registrosFinales = records.slice(0, Math.min(records.length, cupoDisponible));

    const result = await withRetry(() => prisma.$transaction(
      async (tx) => {
        // 8a. Verificar cupo con lock atómico (si tabla existe)
        let cupoFinal = cupoDisponible;
        if (usaCupoDiario) {
          // INSERT si no existe + SELECT FOR UPDATE en una sola operación atómica
          await tx.$executeRaw`
            INSERT INTO cupo_diario (usuario_id, fecha, total_asignado, limite)
            VALUES (${userId}, ${today}, 0, ${maxPerDay})
            ON CONFLICT (usuario_id, fecha) DO NOTHING
          `;

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

        // 8e. Incrementar cupo atómicamente (row ya está locked por FOR UPDATE)
        if (usaCupoDiario) {
          await tx.$executeRaw`
            UPDATE cupo_diario
            SET total_asignado = total_asignado + ${registrosReales.length}
            WHERE usuario_id = ${userId} AND fecha = ${today}
          `;
        }

        return { lote, cantidadReal: registrosReales.length, cupoRestante: cupoFinal - registrosReales.length };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30000,
      }
    ));

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
