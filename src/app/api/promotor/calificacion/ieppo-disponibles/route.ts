import { NextRequest, NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";

export async function GET(req: NextRequest) {
  const { error } = await requirePromotor();
  if (error) return error;

  const url = req.nextUrl.searchParams;
  const search = url.get("search")?.trim() ?? "";
  const page = Math.max(1, Number(url.get("page")) || 1);
  const limit = Math.min(50, Math.max(10, Number(url.get("limit")) || 25));
  const skip = (page - 1) * limit;

  // Column filters
  const filterConvenio = url.get("filter_convenio")?.trim() ?? "";
  const filterEstado = url.get("filter_estado")?.trim() ?? "";

  // Get current round for IEPPO
  const ronda = await prisma.rondas_calificacion.findUnique({ where: { tipo: "IEPPO" } });
  const rondaActual = ronda?.ronda_actual ?? 1;

  // IDs already assigned in this round (from BD Sistema)
  const asignados = await prisma.calificaciones_promotor.findMany({
    where: { tipo: "IEPPO", ronda: rondaActual },
    select: { cliente_id: true },
  });
  const idsAsignados = asignados.map((a) => a.cliente_id);

  // Build where clause for BD Clientes
  const where: Record<string, unknown> = {
    tipo_cliente: "Cartera para calificar IEPPO",
  };
  if (idsAsignados.length > 0) {
    where.id = { notIn: idsAsignados };
  }
  if (search) {
    where.OR = [
      { nombres: { contains: search, mode: "insensitive" } },
      { a_paterno: { contains: search, mode: "insensitive" } },
      { a_materno: { contains: search, mode: "insensitive" } },
      { curp: { contains: search, mode: "insensitive" } },
      { convenio: { contains: search, mode: "insensitive" } },
    ];
  }
  if (filterConvenio) {
    where.convenio = { in: filterConvenio.split(",") };
  }
  if (filterEstado) {
    where.estado = { in: filterEstado.split(",") };
  }

  const [clientes, total] = await Promise.all([
    prismaClientes.clientes.findMany({
      where,
      select: {
        id: true,
        nombres: true,
        a_paterno: true,
        a_materno: true,
        curp: true,
        convenio: true,
        estado: true,
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
    prismaClientes.clientes.count({ where }),
  ]);

  return NextResponse.json({
    clientes,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
