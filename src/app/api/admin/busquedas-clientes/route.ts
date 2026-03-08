import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const usuarioId = params.get("usuario_id");
  const fechaDesde = params.get("fecha_desde");
  const fechaHasta = params.get("fecha_hasta");
  const page = parseInt(params.get("page") || "1");
  const pageSize = 50;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (usuarioId) {
    where.usuario_id = parseInt(usuarioId);
  }

  if (fechaDesde || fechaHasta) {
    where.created_at = {};
    if (fechaDesde) where.created_at.gte = new Date(`${fechaDesde}T00:00:00`);
    if (fechaHasta) where.created_at.lte = new Date(`${fechaHasta}T23:59:59.999`);
  }

  const [busquedas, total] = await Promise.all([
    prisma.busquedas_clientes.findMany({
      where,
      include: {
        usuario: { select: { id: true, nombre: true, username: true, rol: true } },
        logs: {
          select: { id: true, cliente_id: true, campo: true, created_at: true },
          orderBy: { created_at: "asc" },
        },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.busquedas_clientes.count({ where }),
  ]);

  return NextResponse.json({
    busquedas,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}
