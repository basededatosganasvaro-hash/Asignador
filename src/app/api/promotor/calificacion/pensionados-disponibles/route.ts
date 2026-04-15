import { NextRequest, NextResponse } from "next/server";
import { requireCalificacion } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requireCalificacion("PENSIONADOS");
  if (error) return error;

  const url = req.nextUrl.searchParams;
  const search = url.get("search")?.trim() ?? "";
  const page = Math.max(1, Number(url.get("page")) || 1);
  const limit = Math.min(50, Math.max(10, Number(url.get("limit")) || 25));
  const skip = (page - 1) * limit;

  // Column filters
  const filterZona = url.get("filter_zona")?.trim() ?? "";
  const filterMovimiento = url.get("filter_id_movimiento")?.trim() ?? "";
  const filterFechaDesde = url.get("filter_fec_inicio_desde")?.trim() ?? "";
  const filterFechaHasta = url.get("filter_fec_inicio_hasta")?.trim() ?? "";

  // Get current round for PENSIONADOS
  const ronda = await prisma.rondas_calificacion.findUnique({ where: { tipo: "PENSIONADOS" } });
  const rondaActual = ronda?.ronda_actual ?? 1;

  // IDs already assigned in this round
  const asignados = await prisma.calificaciones_promotor.findMany({
    where: { tipo: "PENSIONADOS", ronda: rondaActual },
    select: { cliente_id: true },
  });
  const idsAsignados = asignados.map((a) => a.cliente_id);

  // Build where clause
  const where: Record<string, unknown> = {};
  if (idsAsignados.length > 0) {
    where.id = { notIn: idsAsignados };
  }
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: "insensitive" } },
      { a_paterno: { contains: search, mode: "insensitive" } },
      { a_materno: { contains: search, mode: "insensitive" } },
      { curp: { contains: search, mode: "insensitive" } },
      { nss: { contains: search, mode: "insensitive" } },
    ];
  }
  if (filterZona) {
    where.zona = { in: filterZona.split(",") };
  }
  if (filterMovimiento) {
    where.id_movimiento = { in: filterMovimiento.split(",") };
  }
  if (filterFechaDesde || filterFechaHasta) {
    const cond: Record<string, string> = {};
    if (filterFechaDesde) cond.gte = filterFechaDesde;
    if (filterFechaHasta) cond.lte = filterFechaHasta;
    where.fec_inicio_prestamo = cond;
  }

  const [clientes, total] = await Promise.all([
    prisma.clientes_pensionados.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        a_paterno: true,
        a_materno: true,
        curp: true,
        nss: true,
        zona: true,
        id_movimiento: true,
        imp_saldo_pendiente: true,
        fec_inicio_prestamo: true,
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
    prisma.clientes_pensionados.count({ where }),
  ]);

  return NextResponse.json({
    clientes: clientes.map((c) => ({
      ...c,
      imp_saldo_pendiente: c.imp_saldo_pendiente?.toString() ?? null,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
