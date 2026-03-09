import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireSupervisor } from "@/lib/auth-utils";
import { getConfigBatch } from "@/lib/config-cache";

// ─── Caches ──────────────────────────────────────────────────────────────────

// Exclusion IDs cache (60s)
let excludeCache: { ids: number[]; expiry: number; key: string } | null = null;

// DISTINCT filter values cache (5 min) — dropdown options barely change
const filterCache = new Map<string, { data: string[]; expiry: number }>();
const FILTER_TTL = 300_000; // 5 min

function getCachedFilter(key: string): string[] | null {
  const entry = filterCache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  filterCache.delete(key);
  return null;
}

function setCachedFilter(key: string, data: string[]) {
  filterCache.set(key, { data, expiry: Date.now() + FILTER_TTL });
  // Evict expired entries when cache grows large
  if (filterCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of filterCache) {
      if (now > v.expiry) filterCache.delete(k);
    }
  }
}

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

  // ─── Auth + validation (parallel) ──────────────────────────────────────────
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

  // ─── Exclusion IDs (cached 60s) ────────────────────────────────────────────
  const cooldownDate = new Date();
  cooldownDate.setMonth(cooldownDate.getMonth() - cooldownMeses);

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

  // ─── DISTINCT filter values (cached 5 min, SIN exclusion para velocidad) ───
  // Los dropdowns no necesitan filtrar por exclusion — el COUNT muestra el total exacto
  type FilterRow = { value: string | null }[];
  const filterPromises: Promise<void>[] = [];

  const tiposKey = "tipos";
  const convKey = `conv_${tipo_cliente || "*"}`;
  const estKey = `est_${tipo_cliente || "*"}_${convenio || "*"}`;
  const munKey = `mun_${tipo_cliente || "*"}_${convenio || "*"}_${estado || "*"}`;

  let tipos: string[] = getCachedFilter(tiposKey) || [];
  let convs: string[] = getCachedFilter(convKey) || [];
  let ests: string[] = getCachedFilter(estKey) || [];
  let muns: string[] = (estado ? getCachedFilter(munKey) : null) || [];

  if (!getCachedFilter(tiposKey)) {
    filterPromises.push(
      prismaClientes.$queryRaw<FilterRow>`
        SELECT DISTINCT tipo_cliente AS value FROM clientes
        WHERE tipo_cliente IS NOT NULL ORDER BY 1
      `.then((rows) => {
        tipos = rows.map((r) => r.value).filter(Boolean) as string[];
        setCachedFilter(tiposKey, tipos);
      })
    );
  }

  if (!getCachedFilter(convKey)) {
    const q = tipo_cliente
      ? prismaClientes.$queryRawUnsafe<FilterRow>(
          `SELECT DISTINCT convenio AS value FROM clientes WHERE convenio IS NOT NULL AND tipo_cliente = $1 ORDER BY 1`,
          tipo_cliente
        )
      : prismaClientes.$queryRaw<FilterRow>`
          SELECT DISTINCT convenio AS value FROM clientes WHERE convenio IS NOT NULL ORDER BY 1
        `;
    filterPromises.push(
      q.then((rows) => {
        convs = rows.map((r) => r.value).filter(Boolean) as string[];
        setCachedFilter(convKey, convs);
      })
    );
  }

  if (!getCachedFilter(estKey)) {
    const clauses: string[] = ["estado IS NOT NULL"];
    const params: unknown[] = [];
    if (tipo_cliente) { params.push(tipo_cliente); clauses.push(`tipo_cliente = $${params.length}`); }
    if (convenio) { params.push(convenio); clauses.push(`convenio = $${params.length}`); }
    const sql = `SELECT DISTINCT estado AS value FROM clientes WHERE ${clauses.join(" AND ")} ORDER BY 1`;
    filterPromises.push(
      prismaClientes.$queryRawUnsafe<FilterRow>(sql, ...params).then((rows) => {
        ests = rows.map((r) => r.value).filter(Boolean) as string[];
        setCachedFilter(estKey, ests);
      })
    );
  }

  if (estado && !getCachedFilter(munKey)) {
    const clauses: string[] = ["municipio IS NOT NULL"];
    const params: unknown[] = [];
    if (tipo_cliente) { params.push(tipo_cliente); clauses.push(`tipo_cliente = $${params.length}`); }
    if (convenio) { params.push(convenio); clauses.push(`convenio = $${params.length}`); }
    params.push(estado); clauses.push(`estado = $${params.length}`);
    const sql = `SELECT DISTINCT municipio AS value FROM clientes WHERE ${clauses.join(" AND ")} ORDER BY 1`;
    filterPromises.push(
      prismaClientes.$queryRawUnsafe<FilterRow>(sql, ...params).then((rows) => {
        muns = rows.map((r) => r.value).filter(Boolean) as string[];
        setCachedFilter(munKey, muns);
      })
    );
  }

  // ─── COUNT (siempre fresco, con exclusion) + Cupo ──────────────────────────
  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());

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

  // ─── Todo en paralelo: filtros pendientes + COUNT + cupo ───────────────────
  const [, disponibles, cupoData] = await Promise.all([
    Promise.all(filterPromises),
    prismaClientes.$queryRawUnsafe<{ count: number }[]>(countSql, ...countParams)
      .then((r) => r[0]?.count ?? 0),
    prisma.cupo_diario.findUnique({
      where: { usuario_id_fecha: { usuario_id: targetUserId, fecha: today } },
    }).catch(() => null),
  ]);

  const cupoRestante = Math.max(0, maxPerDay - (cupoData?.total_asignado ?? 0));

  return NextResponse.json({
    tiposCliente: tipos,
    convenios: convs,
    estados: ests,
    municipios: muns,
    disponibles,
    cupoRestante,
    cupoMaximo: maxPerDay,
    asignables: Math.min(disponibles, cupoRestante),
  });
}
