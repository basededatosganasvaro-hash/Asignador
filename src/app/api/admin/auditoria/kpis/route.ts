import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { Prisma } from "@prisma/client";
import { serializeBigInt } from "@/lib/utils";

export async function GET(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const where: Prisma.access_logWhereInput = {};
  if (desde || hasta) {
    where.created_at = {};
    if (desde) (where.created_at as Prisma.DateTimeFilter).gte = new Date(desde);
    if (hasta) {
      const d = new Date(hasta);
      d.setHours(23, 59, 59, 999);
      (where.created_at as Prisma.DateTimeFilter).lte = d;
    }
  }

  const [total, usuariosUnicos, porAccion, sospechosos] = await Promise.all([
    prisma.access_log.count({ where }),
    prisma.access_log.findMany({
      where,
      distinct: ["usuario_id"],
      select: { usuario_id: true },
    }),
    prisma.access_log.groupBy({
      by: ["accion"],
      where,
      _count: { _all: true },
      orderBy: { _count: { accion: "desc" } },
      take: 10,
    }),
    // Sospechosos: usuarios con >100 view_cliente o view_oportunidad en 1 hora
    prisma.$queryRaw<{ usuario_id: number; username: string | null; eventos: number }[]>`
      SELECT usuario_id, username, COUNT(*)::int as eventos
      FROM access_log
      WHERE accion IN ('view_cliente', 'view_oportunidad')
        ${desde ? Prisma.sql`AND created_at >= ${new Date(desde)}` : Prisma.empty}
        ${hasta ? Prisma.sql`AND created_at <= ${new Date(hasta)}` : Prisma.empty}
      GROUP BY usuario_id, username, date_trunc('hour', created_at)
      HAVING COUNT(*) > 100
      ORDER BY eventos DESC
      LIMIT 5
    `,
  ]);

  return NextResponse.json({
    total,
    usuariosUnicos: usuariosUnicos.filter((u) => u.usuario_id !== null).length,
    porAccion: serializeBigInt(porAccion).map((r: { accion: string; _count: { _all: number } }) => ({
      accion: r.accion,
      total: r._count._all,
    })),
    sospechosos: serializeBigInt(sospechosos),
  });
}
