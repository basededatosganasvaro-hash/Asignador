import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireSupervisor } from "@/lib/auth-utils";
import { getConfigBatch } from "@/lib/config-cache";

// Cache de exclusion en memoria — TTL 60s para evitar query pesada en cada cambio de filtro
let excludeCache: { ids: number[]; expiry: number; key: string } | null = null;

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

export async function GET(req: Request) {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const supervisorId = parseInt(session.user.id);

  const { searchParams } = new URL(req.url);
  const promotor_id = searchParams.get("promotor_id") ? Number(searchParams.get("promotor_id")) : undefined;
  const tipo_cliente = searchParams.get("tipo_cliente") || undefined;
  const convenio = searchParams.get("convenio") || undefined;
  const estado = searchParams.get("estado") || undefined;
  const municipio = searchParams.get("municipio") || undefined;
  const tiene_telefono = searchParams.get("tiene_telefono") === "true" || searchParams.get("tiene_telefono") === "1";
  const rango_oferta = searchParams.get("rango_oferta") || undefined;

  // Queries paralelas: supervisor + promotor + config (batch)
  const [supervisor, promotorData, configs] = await Promise.all([
    prisma.usuarios.findUnique({
      where: { id: supervisorId },
      select: { equipo_id: true },
    }),
    promotor_id
      ? prisma.usuarios.findUnique({
          where: { id: promotor_id },
          select: { equipo_id: true },
        })
      : Promise.resolve(null),
    getConfigBatch(["cooldown_meses", "max_registros_por_dia"]),
  ]);

  if (!supervisor?.equipo_id) {
    return NextResponse.json({ error: "No tienes equipo asignado" }, { status: 400 });
  }

  if (promotor_id && (!promotorData || promotorData.equipo_id !== supervisor.equipo_id)) {
    return NextResponse.json({ error: "Promotor no pertenece a tu equipo" }, { status: 403 });
  }

  const targetUserId = promotor_id || supervisorId;
  const cooldownMeses = parseInt(configs["cooldown_meses"] || "3");
  const maxPerDay = parseInt(configs["max_registros_por_dia"] || "300");

  const cooldownDate = new Date();
  cooldownDate.setMonth(cooldownDate.getMonth() - cooldownMeses);

  // Cache de IDs excluidos — reutilizar si es el mismo usuario y no expiro
  const cacheKey = `${targetUserId}_${cooldownMeses}`;
  let excludeArray: number[];

  if (excludeCache && excludeCache.key === cacheKey && Date.now() < excludeCache.expiry) {
    excludeArray = excludeCache.ids;
  } else {
    const excludeRows = await prisma.$queryRaw<{ cliente_id: number }[]>`
      SELECT DISTINCT cliente_id FROM oportunidades
      WHERE cliente_id IS NOT NULL
        AND (activo = true OR (usuario_id = ${targetUserId} AND created_at >= ${cooldownDate}))
    `;
    excludeArray = excludeRows.map((r) => r.cliente_id);
    excludeCache = { ids: excludeArray, expiry: Date.now() + 60_000, key: cacheKey };
  }

  // Cupo — en paralelo con las queries de BD Clientes
  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());

  // Construir SQL para conteo
  const rangoOferta = parseRangoOferta(rango_oferta);
  const OFERTA_NUM = `CAST(NULLIF(regexp_replace(COALESCE(oferta, ''), '[^0-9]', '', 'g'), '') AS NUMERIC)`;
  const countParams: unknown[] = [];
  const countClauses: string[] = [];

  if (excludeArray.length > 0) {
    countParams.push(excludeArray);
    countClauses.push(`id != ALL($${countParams.length})`);
  }
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

  const baseExclude = excludeArray.length > 0 ? { id: { notIn: excludeArray } } : {};

  // Todas las queries en paralelo: 4 DISTINCT + 1 COUNT + 1 cupo
  const [tiposRaw, conveniosRaw, estadosRaw, municipiosRaw, disponibles, cupoData] = await Promise.all([
    prismaClientes.clientes.findMany({
      select: { tipo_cliente: true },
      distinct: ["tipo_cliente"],
      where: { ...baseExclude },
      orderBy: { tipo_cliente: "asc" },
    }),
    prismaClientes.clientes.findMany({
      select: { convenio: true },
      distinct: ["convenio"],
      where: {
        ...baseExclude,
        ...(tipo_cliente ? { tipo_cliente } : {}),
      },
      orderBy: { convenio: "asc" },
    }),
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
    prismaClientes.$queryRawUnsafe<{ count: number }[]>(countSql, ...countParams)
      .then((r) => r[0]?.count ?? 0),
    prisma.cupo_diario.findUnique({
      where: { usuario_id_fecha: { usuario_id: targetUserId, fecha: today } },
    }).catch(() => null),
  ]);

  const cupoRestante = Math.max(0, maxPerDay - (cupoData?.total_asignado ?? 0));

  return NextResponse.json({
    tiposCliente: tiposRaw.map((r) => r.tipo_cliente).filter(Boolean),
    convenios: conveniosRaw.map((r) => r.convenio).filter(Boolean),
    estados: estadosRaw.map((r) => r.estado).filter(Boolean),
    municipios: municipiosRaw.map((r) => (r as { municipio?: string | null }).municipio).filter(Boolean),
    disponibles,
    cupoRestante,
    cupoMaximo: maxPerDay,
    asignables: Math.min(disponibles, cupoRestante),
  });
}
