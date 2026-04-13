import { NextRequest, NextResponse } from "next/server";
import { requireCalificacion } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requireCalificacion("CDMX");
  if (error) return error;

  const url = req.nextUrl.searchParams;
  const search = url.get("search")?.trim() ?? "";
  const page = Math.max(1, Number(url.get("page")) || 1);
  const limit = Math.min(50, Math.max(10, Number(url.get("limit")) || 25));
  const skip = (page - 1) * limit;

  // Get current round for CDMX
  const ronda = await prisma.rondas_calificacion.findUnique({ where: { tipo: "CDMX" } });
  const rondaActual = ronda?.ronda_actual ?? 1;

  // IDs already assigned in this round
  const asignados = await prisma.calificaciones_promotor.findMany({
    where: { tipo: "CDMX", ronda: rondaActual },
    select: { cliente_id: true },
  });
  const idsAsignados = asignados.map((a) => a.cliente_id);

  // Column filters (comma-separated values)
  const filterInstitucion = url.get("filter_institucion")?.trim() ?? "";
  const filterPuesto = url.get("filter_puesto")?.trim() ?? "";
  const filterServicio = url.get("filter_servicio")?.trim() ?? "";

  // Build where clause
  const where: Record<string, unknown> = {};
  if (idsAsignados.length > 0) {
    where.id = { notIn: idsAsignados };
  }
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: "insensitive" } },
      { rfc: { contains: search, mode: "insensitive" } },
      { institucion: { contains: search, mode: "insensitive" } },
    ];
  }
  if (filterInstitucion) {
    where.institucion = { in: filterInstitucion.split(",") };
  }
  if (filterPuesto) {
    where.puesto = { in: filterPuesto.split(",") };
  }
  if (filterServicio) {
    where.servicio = { in: filterServicio.split(",") };
  }

  const [clientes, total] = await Promise.all([
    prisma.clientes_cdmx.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        rfc: true,
        institucion: true,
        puesto: true,
        nomina: true,
        servicio: true,
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
    prisma.clientes_cdmx.count({ where }),
  ]);

  return NextResponse.json({
    clientes,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
