import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { serializeBigInt } from "@/lib/utils";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const usuario_id = parseInt(id);

  const { searchParams } = new URL(req.url);
  const dias = Math.min(90, Math.max(1, parseInt(searchParams.get("dias") ?? "30")));
  const desdeDate = new Date();
  desdeDate.setDate(desdeDate.getDate() - dias);

  const usuario = await prisma.usuarios.findUnique({
    where: { id: usuario_id },
    select: { id: true, username: true, nombre: true, rol: true, activo: true, region_id: true, sucursal_id: true },
  });

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const [eventos, porAccion, recursosUnicos, actividadPorHora] = await Promise.all([
    prisma.access_log.findMany({
      where: { usuario_id, created_at: { gte: desdeDate } },
      orderBy: { created_at: "desc" },
      take: 500,
    }),
    prisma.access_log.groupBy({
      by: ["accion"],
      where: { usuario_id, created_at: { gte: desdeDate } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ recurso_id: string; accion: string; visitas: number; ultima: Date }[]>`
      SELECT recurso_id, accion, COUNT(*)::int as visitas, MAX(created_at) as ultima
      FROM access_log
      WHERE usuario_id = ${usuario_id}
        AND recurso_id IS NOT NULL
        AND created_at >= ${desdeDate}
      GROUP BY recurso_id, accion
      ORDER BY visitas DESC
      LIMIT 50
    `,
    prisma.$queryRaw<{ hora: string; eventos: number }[]>`
      SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') as hora, COUNT(*)::int as eventos
      FROM access_log
      WHERE usuario_id = ${usuario_id}
        AND created_at >= ${desdeDate}
      GROUP BY date_trunc('hour', created_at)
      ORDER BY date_trunc('hour', created_at) ASC
    `,
  ]);

  return NextResponse.json({
    usuario,
    dias,
    eventos: serializeBigInt(eventos),
    porAccion: porAccion.map((r) => ({ accion: r.accion, total: r._count._all })),
    recursosUnicos: serializeBigInt(recursosUnicos),
    actividadPorHora: serializeBigInt(actividadPorHora),
  });
}
