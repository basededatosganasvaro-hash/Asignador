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
  const { gte, lte } = parseRangoCalificacion(url);

  const [groups, catalogo] = await Promise.all([
    prisma.calificaciones_promotor.groupBy({
      by: ["retroalimentacion_id"],
      where: {
        calificado: true,
        lote: { fecha: { gte, lte } },
        ...(tipo ? { tipo } : {}),
      },
      _count: { _all: true },
    }),
    prisma.catalogo_retroalimentacion.findMany({
      orderBy: { id: "asc" },
    }),
  ]);

  const nombreById = new Map(catalogo.map((c) => [c.id, c.nombre]));

  const data = groups
    .map((g) => ({
      id: g.retroalimentacion_id,
      nombre: g.retroalimentacion_id
        ? nombreById.get(g.retroalimentacion_id) ?? `Retro #${g.retroalimentacion_id}`
        : "Sin retroalimentación",
      total: g._count._all,
    }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ data });
}
