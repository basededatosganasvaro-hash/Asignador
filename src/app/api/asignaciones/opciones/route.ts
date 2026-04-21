import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requirePromotor } from "@/lib/auth-utils";

/**
 * GET /api/asignaciones/opciones
 * Devuelve opciones en cascada + conteo disponible en una sola llamada.
 * Cada selector solo muestra valores que existen dado el contexto actual.
 *
 * Cascada:
 *   tiposCliente → siempre independiente
 *   convenios    → filtrado por tipo_cliente seleccionado
 *   estados      → filtrado por tipo_cliente + convenio
 *   municipios   → filtrado por tipo_cliente + convenio + estado
 *   disponibles  → conteo con todos los filtros + excluye activos
 */
export async function GET(req: Request) {
  const { session, error } = await requirePromotor();
  if (error) return error;

  const userId = parseInt(session.user.id);
  const { searchParams } = new URL(req.url);

  const tipo_cliente  = searchParams.get("tipo_cliente")  || undefined;
  const convenio      = searchParams.get("convenio")      || undefined;
  const estado        = searchParams.get("estado")        || undefined;
  const municipio     = searchParams.get("municipio")     || undefined;
  const tiene_telefono = searchParams.get("tiene_telefono") === "true" || searchParams.get("tiene_telefono") === "1";
  const rango_oferta   = searchParams.get("rango_oferta")   || undefined;

  // IDs a excluir: activos + cooldown en una sola query
  const cooldownConfig = await prisma.configuracion.findUnique({
    where: { clave: "cooldown_meses" },
  });
  const cooldownMeses = parseInt(cooldownConfig?.valor || "3");
  const cooldownDate = new Date();
  cooldownDate.setMonth(cooldownDate.getMonth() - cooldownMeses);

  const excludeRows = await prisma.$queryRaw<{ cliente_id: number }[]>`
    SELECT DISTINCT cliente_id FROM oportunidades
    WHERE cliente_id IS NOT NULL
      AND (activo = true OR (usuario_id = ${userId} AND created_at >= ${cooldownDate}))
  `;
  const excludeArray = excludeRows.map((r) => r.cliente_id);

  // Base where para excluir activos + cooldown + IEPPO/IEEPO (se asigna vía módulo de analistas)
  const baseExclude = {
    ...(excludeArray.length > 0 ? { id: { notIn: excludeArray } } : {}),
    AND: [
      { NOT: { tipo_cliente: { contains: "IEPPO", mode: "insensitive" as const } } },
      { NOT: { tipo_cliente: { contains: "IEEPO", mode: "insensitive" as const } } },
    ],
  };

  // Cupo restante del día (timezone Mexico)
  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const config = await prisma.configuracion.findUnique({
    where: { clave: "max_registros_por_dia" },
  });
  const maxPerDay = parseInt(config?.valor || "300");

  // Intentar cupo_diario, fallback a lotes si la tabla no existe aún
  let cupoRestante: number;
  try {
    const cupo = await prisma.cupo_diario.findUnique({
      where: { usuario_id_fecha: { usuario_id: userId, fecha: today } },
    });
    cupoRestante = Math.max(0, maxPerDay - (cupo?.total_asignado ?? 0));
  } catch {
    const lotesHoy = await prisma.lotes.findMany({
      where: { usuario_id: userId, fecha: { gte: today, lt: tomorrow } },
      select: { cantidad: true },
    });
    cupoRestante = Math.max(0, maxPerDay - lotesHoy.reduce((s, l) => s + l.cantidad, 0));
  }

  // Parse rango de oferta a min/max numérico
  function parseRangoOferta(rango: string | undefined): { min: number; max: number | null } | null {
    if (!rango) return null;
    switch (rango) {
      case "0-50000": return { min: 0, max: 50000 };
      case "50000-100000": return { min: 50000, max: 100000 };
      case "100000-500000": return { min: 100000, max: 500000 };
      case "500000+": return { min: 500000, max: null };
      default: return null;
    }
  }
  const rangoOferta = parseRangoOferta(rango_oferta);

  // Construir query raw para conteo (soporta CAST numérico de oferta)
  const OFERTA_NUM = `CAST(NULLIF(regexp_replace(COALESCE(oferta, ''), '[^0-9]', '', 'g'), '') AS NUMERIC)`;
  const countParams: unknown[] = [];
  const countClauses: string[] = [];

  if (excludeArray.length > 0) {
    countParams.push(excludeArray);
    countClauses.push(`id != ALL($${countParams.length})`);
  }
  // Excluir IEPPO/IEEPO del conteo disponible (se asigna vía módulo de analistas)
  countClauses.push(`(tipo_cliente IS NULL OR (tipo_cliente NOT ILIKE '%IEPPO%' AND tipo_cliente NOT ILIKE '%IEEPO%'))`);
  if (tipo_cliente) { countParams.push(tipo_cliente); countClauses.push(`tipo_cliente = $${countParams.length}`); }
  if (convenio)     { countParams.push(convenio);     countClauses.push(`convenio = $${countParams.length}`); }
  if (estado)       { countParams.push(estado);       countClauses.push(`estado = $${countParams.length}`); }
  if (municipio)    { countParams.push(municipio);    countClauses.push(`municipio = $${countParams.length}`); }
  if (tiene_telefono) countClauses.push(`tel_1 IS NOT NULL AND TRIM(tel_1) != ''`);
  if (rangoOferta) {
    countParams.push(rangoOferta.min);
    countClauses.push(`${OFERTA_NUM} >= $${countParams.length}`);
    if (rangoOferta.max !== null) {
      countParams.push(rangoOferta.max);
      countClauses.push(`${OFERTA_NUM} < $${countParams.length}`);
    }
  }

  const countWhere = countClauses.length > 0 ? `WHERE ${countClauses.join(" AND ")}` : "";
  const countSql = `SELECT COUNT(*)::int as count FROM clientes ${countWhere}`;

  // Queries en paralelo — cada una filtra por disponibilidad real (excluye activos + cooldown)
  const [tiposRaw, conveniosRaw, estadosRaw, municipiosRaw, disponibles] = await Promise.all([
    // tipo_cliente: siempre independiente
    prismaClientes.clientes.findMany({
      select: { tipo_cliente: true },
      distinct: ["tipo_cliente"],
      where: { ...baseExclude },
      orderBy: { tipo_cliente: "asc" },
    }),

    // convenios: depende de tipo_cliente
    prismaClientes.clientes.findMany({
      select: { convenio: true },
      distinct: ["convenio"],
      where: {
        ...baseExclude,
        ...(tipo_cliente ? { tipo_cliente } : {}),
      },
      orderBy: { convenio: "asc" },
    }),

    // estados: depende de tipo_cliente + convenio
    prismaClientes.clientes.findMany({
      select: { estado: true },
      distinct: ["estado"],
      where: {
        ...baseExclude,
        ...(tipo_cliente ? { tipo_cliente } : {}),
        ...(convenio ? { convenio } : {}),
      },
      orderBy: { estado: "asc" },
    }),

    // municipios: depende de tipo_cliente + convenio + estado
    estado
      ? prismaClientes.clientes.findMany({
          select: { municipio: true },
          distinct: ["municipio"],
          where: {
            ...baseExclude,
            ...(tipo_cliente ? { tipo_cliente } : {}),
            ...(convenio ? { convenio } : {}),
            estado,
          },
          orderBy: { municipio: "asc" },
        })
      : Promise.resolve([]),

    // conteo disponible con todos los filtros activos (raw SQL para soportar rango oferta)
    prismaClientes.$queryRawUnsafe<{ count: number }[]>(countSql, ...countParams)
      .then((r) => r[0]?.count ?? 0),
  ]);

  return NextResponse.json({
    tiposCliente: tiposRaw.map((r) => r.tipo_cliente).filter(Boolean),
    convenios:    conveniosRaw.map((r) => r.convenio).filter(Boolean),
    estados:      estadosRaw.map((r) => r.estado).filter(Boolean),
    municipios:   municipiosRaw.map((r) => (r as { municipio?: string | null }).municipio).filter(Boolean),
    disponibles,
    cupoRestante,
    cupoMaximo: maxPerDay,
    asignables: Math.min(disponibles, cupoRestante),
  });
}
