import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { serializeBigInt } from "@/lib/utils";
import { logAccessWithSession } from "@/lib/access-log";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(10, parseInt(searchParams.get("pageSize") ?? "50")));
  const usuario_id = searchParams.get("usuario_id");
  const accionParam = searchParams.get("accion"); // CSV
  const recurso_id = searchParams.get("recurso_id");
  const ip = searchParams.get("ip");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const search = searchParams.get("search");

  const where: Prisma.access_logWhereInput = {};
  if (usuario_id) where.usuario_id = parseInt(usuario_id);
  if (accionParam) {
    const acciones = accionParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (acciones.length > 0) where.accion = { in: acciones };
  }
  if (recurso_id) where.recurso_id = recurso_id;
  if (ip) where.ip = { contains: ip };
  if (desde || hasta) {
    where.created_at = {};
    if (desde) (where.created_at as Prisma.DateTimeFilter).gte = new Date(desde);
    if (hasta) {
      const d = new Date(hasta);
      d.setHours(23, 59, 59, 999);
      (where.created_at as Prisma.DateTimeFilter).lte = d;
    }
  }
  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { recurso_id: { contains: search, mode: "insensitive" } },
      { accion: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.access_log.count({ where }),
    prisma.access_log.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  logAccessWithSession(session, "view_auditoria", { metadata: { page, pageSize, filtros: { usuario_id, accion: accionParam, desde, hasta } }, req });

  return NextResponse.json({
    total,
    page,
    pageSize,
    items: serializeBigInt(rows),
  });
}
