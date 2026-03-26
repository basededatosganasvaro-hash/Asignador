import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireSupervisor } from "@/lib/auth-utils";
import { calcularTimerVenceConConfig } from "@/lib/horario";
import { getConfig, getConfigBatch } from "@/lib/config-cache";
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

// GET: Lista promotores del equipo con cupo
export async function GET() {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const supervisorId = parseInt(session.user.id);

  // Paralelizar: supervisor data + config
  const [supervisor, maxPerDayStr] = await Promise.all([
    prisma.usuarios.findUnique({
      where: { id: supervisorId },
      select: { equipo_id: true },
    }),
    getConfig("max_registros_por_dia"),
  ]);

  if (!supervisor?.equipo_id) {
    return NextResponse.json({ error: "No tienes equipo asignado" }, { status: 400 });
  }

  const equipoId = supervisor.equipo_id;
  const maxPerDay = parseInt(maxPerDayStr || "300");

  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());

  // Promotores + cupos + oportunidades activas — todo en paralelo
  const promotores = await prisma.usuarios.findMany({
    where: { equipo_id: equipoId, rol: "promotor", activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const promotorIds = promotores.map((p) => p.id);

  const [cupos, activasCounts] = await Promise.all([
    prisma.cupo_diario.findMany({
      where: { usuario_id: { in: promotorIds }, fecha: today },
      select: { usuario_id: true, total_asignado: true, limite: true },
    }),
    prisma.oportunidades.groupBy({
      by: ["usuario_id"],
      where: { usuario_id: { in: promotorIds }, activo: true },
      _count: { id: true },
    }),
  ]);

  const cupoMap = new Map(cupos.map((c) => [c.usuario_id, c]));
  const activasMap = new Map(activasCounts.map((a) => [a.usuario_id!, a._count.id]));

  const result = promotores.map((p) => {
    const cupo = cupoMap.get(p.id);
    const limite = cupo?.limite ?? maxPerDay;
    const asignado = cupo?.total_asignado ?? 0;
    return {
      id: p.id,
      nombre: p.nombre,
      cupoRestante: Math.max(0, limite - asignado),
      cupoMaximo: limite,
      oportunidadesActivas: activasMap.get(p.id) ?? 0,
    };
  });

  return NextResponse.json({ promotores: result });
}

// POST: Solicitar datos del pool para un promotor
export async function POST(request: Request) {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const supervisorId = parseInt(session.user.id);

  let promotor_id: number;
  let cantidad: number | undefined;
  let tipo_cliente: string | undefined;
  let convenio: string | undefined;
  let estado: string | undefined;
  let municipio: string | undefined;
  let rango_oferta: string | undefined;
  let tiene_telefono: boolean | undefined;

  try {
    const body = await request.json();
    promotor_id = Number(body.promotor_id);
    if (!promotor_id) {
      return NextResponse.json({ error: "promotor_id es requerido" }, { status: 400 });
    }
    cantidad = body.cantidad != null ? Math.floor(Number(body.cantidad)) : undefined;
    if (cantidad != null && (!Number.isFinite(cantidad) || cantidad < 1)) {
      return NextResponse.json({ error: "Cantidad debe ser un numero entero positivo" }, { status: 400 });
    }
    tipo_cliente = body.tipo_cliente || undefined;
    convenio = body.convenio || undefined;
    estado = body.estado || undefined;
    municipio = body.municipio || undefined;
    rango_oferta = body.rango_oferta || undefined;
    tiene_telefono = body.tiene_telefono || false;
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  // Paralelizar: supervisor + promotor + config (todo en 1 round trip)
  const [supervisor, promotor, configs] = await Promise.all([
    prisma.usuarios.findUnique({
      where: { id: supervisorId },
      select: { equipo_id: true },
    }),
    prisma.usuarios.findUnique({
      where: { id: promotor_id },
      select: { id: true, equipo_id: true, activo: true },
    }),
    getConfigBatch(["max_registros_por_dia", "cooldown_meses"]),
  ]);

  if (!supervisor?.equipo_id) {
    return NextResponse.json({ error: "No tienes equipo asignado" }, { status: 400 });
  }

  const equipoId = supervisor.equipo_id;

  if (!promotor || promotor.equipo_id !== equipoId) {
    return NextResponse.json({ error: "Promotor no pertenece a tu equipo" }, { status: 403 });
  }

  if (!promotor.activo) {
    return NextResponse.json({ error: "Promotor no esta activo" }, { status: 400 });
  }

  // NO horario validation for supervisor

  try {
    const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());

    const maxPerDay = parseInt(configs["max_registros_por_dia"] || "300");

    // Cupo + cooldown exclude en paralelo
    const cooldownMeses = parseInt(configs["cooldown_meses"] || "3");
    const cooldownDate = new Date();
    cooldownDate.setMonth(cooldownDate.getMonth() - cooldownMeses);

    const [cupoExistente, excludeRows] = await Promise.all([
      prisma.cupo_diario.findUnique({
        where: { usuario_id_fecha: { usuario_id: promotor_id, fecha: today } },
      }).catch(() => null),
      prisma.$queryRaw<{ cliente_id: number }[]>`
        SELECT DISTINCT cliente_id FROM oportunidades
        WHERE cliente_id IS NOT NULL
          AND (activo = true OR (usuario_id = ${promotor_id} AND created_at >= ${cooldownDate}))
      `,
    ]);

    const yaAsignados = cupoExistente?.total_asignado ?? 0;
    const usaCupoDiario = !!cupoExistente || true;
    const cupoDisponible = maxPerDay - yaAsignados;

    if (cupoDisponible <= 0) {
      return NextResponse.json(
        { error: "El promotor ha alcanzado el limite diario de asignaciones", cupo_restante: 0 },
        { status: 409 }
      );
    }

    const requested = Math.min(cantidad || cupoDisponible, cupoDisponible);

    const excludeArray = excludeRows.map((r) => r.cliente_id);

    // Build SQL
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

    // Rango de oferta — CAST numérico del campo oferta (varchar)
    if (rango_oferta) {
      const OFERTA_NUM = `CAST(NULLIF(regexp_replace(COALESCE(oferta, ''), '[^0-9]', '', 'g'), '') AS NUMERIC)`;
      const rangos: Record<string, { min: number; max: number | null }> = {
        "0-50000": { min: 0, max: 50000 },
        "50000-100000": { min: 50000, max: 100000 },
        "100000-500000": { min: 100000, max: 500000 },
        "500000+": { min: 500000, max: null },
      };
      const rango = rangos[rango_oferta];
      if (rango) {
        params.push(rango.min);
        clauses.push(`${OFERTA_NUM} >= $${params.length}`);
        if (rango.max !== null) {
          params.push(rango.max);
          clauses.push(`${OFERTA_NUM} < $${params.length}`);
        }
      }
    }

    params.push(requested);
    const limitParam = `$${params.length}`;

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const sql = `SELECT id FROM clientes ${whereClause} ORDER BY RANDOM() LIMIT ${limitParam}`;

    const records = await prismaClientes.$queryRawUnsafe<{ id: number }[]>(sql, ...params);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No hay registros disponibles para asignar" },
        { status: 404 }
      );
    }

    const etapaAsignado = await prisma.embudo_etapas.findFirst({
      where: { nombre: "Asignado", activo: true },
    });
    const timerVence = etapaAsignado?.timer_dias
      ? await calcularTimerVenceConConfig(etapaAsignado.timer_dias)
      : null;

    const registrosFinales = records.slice(0, Math.min(records.length, cupoDisponible));

    const result = await withRetry(() => prisma.$transaction(
      async (tx) => {
        let cupoFinal = cupoDisponible;
        if (usaCupoDiario) {
          await tx.$executeRaw`
            INSERT INTO cupo_diario (usuario_id, fecha, total_asignado, limite)
            VALUES (${promotor_id}, ${today}, 0, ${maxPerDay})
            ON CONFLICT (usuario_id, fecha) DO NOTHING
          `;

          const cupoRows = await tx.$queryRaw<{ id: number; total_asignado: number; limite: number }[]>`
            SELECT id, total_asignado, limite FROM cupo_diario
            WHERE usuario_id = ${promotor_id} AND fecha = ${today}
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

        const lote = await tx.lotes.create({
          data: {
            usuario_id: promotor_id,
            fecha: today,
            cantidad: registrosReales.length,
          },
        });

        await tx.oportunidades.createMany({
          data: registrosReales.map((r) => ({
            cliente_id: r.id,
            usuario_id: promotor_id,
            etapa_id: etapaAsignado?.id ?? null,
            origen: "SUPERVISOR",
            lote_id: lote.id,
            timer_vence: timerVence,
            activo: true,
          })),
        });

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
            nota: `Asignacion por supervisor a promotor #${promotor_id}`,
          })),
        });

        if (usaCupoDiario) {
          await tx.$executeRaw`
            UPDATE cupo_diario
            SET total_asignado = total_asignado + ${registrosReales.length}
            WHERE usuario_id = ${promotor_id} AND fecha = ${today}
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
        { error: "El promotor ha alcanzado el limite diario de asignaciones", cupo_restante: 0 },
        { status: 409 }
      );
    }
    console.error("Error al crear lote:", err instanceof Error ? err.message : "Error desconocido");
    return NextResponse.json(
      { error: "Error al crear la asignacion" },
      { status: 500 }
    );
  }
}
