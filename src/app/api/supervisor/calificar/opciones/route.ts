import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireSupervisor } from "@/lib/auth-utils";

// ─── Caches ──────────────────────────────────────────────────────────────────

let excludeCache: { ids: number[]; expiry: number; key: string } | null = null;

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

const TIPOS_PERMITIDOS = ["Compilado Cartera", "Cartera para calificar IEPPO"];

export async function GET(req: Request) {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const supervisorId = parseInt(session.user.id);

  const { searchParams } = new URL(req.url);
  const tipo_cliente = searchParams.get("tipo_cliente") || TIPOS_PERMITIDOS[0];
  const tipoCliente = TIPOS_PERMITIDOS.includes(tipo_cliente) ? tipo_cliente : TIPOS_PERMITIDOS[0];
  const convenio = searchParams.get("convenio") || undefined;
  const estado = searchParams.get("estado") || undefined;
  const municipio = searchParams.get("municipio") || undefined;
  const tiene_telefono = searchParams.get("tiene_telefono") === "true" || searchParams.get("tiene_telefono") === "1";
  const rango_oferta = searchParams.get("rango_oferta") || undefined;

  // ─── Exclusion IDs: oportunidades activas + calificaciones_supervisor activas + pool_supervisor no asignado
  const cacheKey = `sup_cal_${supervisorId}`;
  let excludeArray: number[];

  if (excludeCache && excludeCache.key === cacheKey && Date.now() < excludeCache.expiry) {
    excludeArray = excludeCache.ids;
  } else {
    const [excOportunidades, excCalificaciones, excPool] = await Promise.all([
      prisma.$queryRaw<{ cliente_id: number }[]>`
        SELECT DISTINCT cliente_id FROM oportunidades
        WHERE cliente_id IS NOT NULL AND activo = true
      `,
      prisma.$queryRaw<{ cliente_id: number }[]>`
        SELECT DISTINCT cs.cliente_id FROM calificaciones_supervisor cs
        JOIN lotes_supervisor ls ON ls.id = cs.lote_id
        WHERE ls.estado IN ('PENDIENTE', 'EN_PROCESO')
      `,
      prisma.$queryRaw<{ cliente_id: number }[]>`
        SELECT DISTINCT cliente_id FROM pool_supervisor
        WHERE asignado = false AND expira_at > NOW()
      `,
    ]);

    const idSet = new Set<number>();
    for (const r of excOportunidades) idSet.add(r.cliente_id);
    for (const r of excCalificaciones) idSet.add(r.cliente_id);
    for (const r of excPool) idSet.add(r.cliente_id);
    excludeArray = [...idSet];
    excludeCache = { ids: excludeArray, expiry: Date.now() + 60_000, key: cacheKey };
  }

  // ─── DISTINCT filter values (cached 5 min) ───
  type FilterRow = { value: string | null }[];
  const filterPromises: Promise<void>[] = [];

  const convKey = `sup_conv_${tipoCliente}`;
  const estKey = `sup_est_${tipoCliente}_${convenio || "*"}`;
  const munKey = `sup_mun_${tipoCliente}_${convenio || "*"}_${estado || "*"}`;

  let convs: string[] = getCachedFilter(convKey) || [];
  let ests: string[] = getCachedFilter(estKey) || [];
  let muns: string[] = (estado ? getCachedFilter(munKey) : null) || [];

  if (!getCachedFilter(convKey)) {
    filterPromises.push(
      prismaClientes.$queryRawUnsafe<FilterRow>(
        `SELECT DISTINCT convenio AS value FROM clientes WHERE convenio IS NOT NULL AND tipo_cliente = $1 ORDER BY 1`,
        tipoCliente
      ).then((rows) => {
        convs = rows.map((r) => r.value).filter(Boolean) as string[];
        setCachedFilter(convKey, convs);
      })
    );
  }

  if (!getCachedFilter(estKey)) {
    const clauses: string[] = ["estado IS NOT NULL", `tipo_cliente = $1`];
    const params: unknown[] = [tipoCliente];
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
    const clauses: string[] = ["municipio IS NOT NULL", `tipo_cliente = $1`];
    const params: unknown[] = [tipoCliente];
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

  // ─── COUNT (fresco, con exclusion) ───
  const rangoOferta = parseRangoOferta(rango_oferta);
  const OFERTA_NUM = `CAST(NULLIF(regexp_replace(COALESCE(oferta, ''), '[^0-9]', '', 'g'), '') AS NUMERIC)`;
  const countParams: unknown[] = [tipoCliente];
  const countClauses: string[] = [`tipo_cliente = $1`];

  if (excludeArray.length > 0) {
    countParams.push(excludeArray);
    countClauses.push(`id != ALL($${countParams.length})`);
  }
  if (convenio)  { countParams.push(convenio);  countClauses.push(`convenio = $${countParams.length}`); }
  if (estado)    { countParams.push(estado);    countClauses.push(`estado = $${countParams.length}`); }
  if (municipio) { countParams.push(municipio); countClauses.push(`municipio = $${countParams.length}`); }
  if (tiene_telefono) countClauses.push(`tel_1 IS NOT NULL AND TRIM(tel_1) != ''`);
  if (rangoOferta) {
    countParams.push(rangoOferta.min);
    countClauses.push(`${OFERTA_NUM} >= $${countParams.length}`);
    if (rangoOferta.max !== null) {
      countParams.push(rangoOferta.max);
      countClauses.push(`${OFERTA_NUM} < $${countParams.length}`);
    }
  }

  const countSql = `SELECT COUNT(*)::int as count FROM clientes WHERE ${countClauses.join(" AND ")}`;

  const [, disponibles] = await Promise.all([
    Promise.all(filterPromises),
    prismaClientes.$queryRawUnsafe<{ count: number }[]>(countSql, ...countParams)
      .then((r) => r[0]?.count ?? 0),
  ]);

  return NextResponse.json({
    tiposCliente: TIPOS_PERMITIDOS,
    tipoCliente,
    convenios: convs,
    estados: ests,
    municipios: muns,
    disponibles,
  });
}
