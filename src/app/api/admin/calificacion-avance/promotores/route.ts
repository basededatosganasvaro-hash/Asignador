import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import {
  FUENTES_CALIFICACION as FUENTES,
  type FuenteCalificacion as Fuente,
  parseRangoCalificacion,
} from "@/lib/calificacion-avance";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = req.nextUrl.searchParams;
  const tipoParam = url.get("tipo");
  const tipo =
    tipoParam && (FUENTES as readonly string[]).includes(tipoParam)
      ? (tipoParam as Fuente)
      : null;
  const q = url.get("q")?.trim() ?? "";
  const { gte, lte } = parseRangoCalificacion(url);

  const calWhere = {
    lote: { fecha: { gte, lte } },
    ...(tipo ? { tipo } : {}),
  };
  const loteWhere = {
    fecha: { gte, lte },
    ...(tipo ? { tipo } : {}),
  };

  const [groups, lotesCount, lastLotes] = await Promise.all([
    prisma.calificaciones_promotor.groupBy({
      by: ["promotor_id", "tipo", "calificado"],
      where: calWhere,
      _count: { _all: true },
    }),
    prisma.lotes_calificacion_promotor.groupBy({
      by: ["promotor_id"],
      where: loteWhere,
      _count: { _all: true },
    }),
    prisma.lotes_calificacion_promotor.groupBy({
      by: ["promotor_id"],
      where: loteWhere,
      _max: { fecha: true },
    }),
  ]);

  const lotesMap = new Map(lotesCount.map((l) => [l.promotor_id, l._count._all]));
  const lastLoteMap = new Map(lastLotes.map((l) => [l.promotor_id, l._max.fecha]));

  const promotorIds = Array.from(
    new Set([...groups.map((g) => g.promotor_id), ...lotesCount.map((l) => l.promotor_id)]),
  );

  if (promotorIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const usuarios = await prisma.usuarios.findMany({
    where: {
      id: { in: promotorIds },
      ...(q ? { nombre: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true,
      nombre: true,
      username: true,
      permisos_calificacion: true,
      activo: true,
      sucursal: { select: { nombre: true } },
    },
  });

  type Row = {
    id: number;
    nombre: string;
    username: string;
    sucursal: string;
    permisos: string[];
    activo: boolean;
    asignados: number;
    calificados: number;
    pendientes: number;
    pct_avance: number;
    por_tipo: Record<Fuente, { asignados: number; calificados: number }>;
    lotes: number;
    ultimo_lote: string | null;
  };

  const byPromotor: Record<number, Row> = {};
  usuarios.forEach((u) => {
    byPromotor[u.id] = {
      id: u.id,
      nombre: u.nombre,
      username: u.username,
      sucursal: u.sucursal?.nombre ?? "—",
      permisos: u.permisos_calificacion,
      activo: u.activo,
      asignados: 0,
      calificados: 0,
      pendientes: 0,
      pct_avance: 0,
      por_tipo: {
        IEPPO: { asignados: 0, calificados: 0 },
        CDMX: { asignados: 0, calificados: 0 },
        PENSIONADOS: { asignados: 0, calificados: 0 },
      },
      lotes: lotesMap.get(u.id) ?? 0,
      ultimo_lote: lastLoteMap.get(u.id)?.toISOString().slice(0, 10) ?? null,
    };
  });

  groups.forEach((g) => {
    const row = byPromotor[g.promotor_id];
    if (!row) return;
    row.asignados += g._count._all;
    if (g.calificado) row.calificados += g._count._all;
    const f = g.tipo as Fuente;
    if (row.por_tipo[f]) {
      row.por_tipo[f].asignados += g._count._all;
      if (g.calificado) row.por_tipo[f].calificados += g._count._all;
    }
  });

  const data = Object.values(byPromotor).map((r) => {
    r.pendientes = r.asignados - r.calificados;
    r.pct_avance =
      r.asignados > 0 ? Math.round((r.calificados / r.asignados) * 10000) / 100 : 0;
    return r;
  });

  data.sort((a, b) => b.asignados - a.asignados || a.nombre.localeCompare(b.nombre));

  return NextResponse.json({ data });
}
