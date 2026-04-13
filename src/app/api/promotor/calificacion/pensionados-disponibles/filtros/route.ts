import { NextResponse } from "next/server";
import { requireCalificacion } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireCalificacion("PENSIONADOS");
  if (error) return error;

  // Get current round for PENSIONADOS
  const ronda = await prisma.rondas_calificacion.findUnique({ where: { tipo: "PENSIONADOS" } });
  const rondaActual = ronda?.ronda_actual ?? 1;

  // IDs already assigned in this round
  const asignados = await prisma.calificaciones_promotor.findMany({
    where: { tipo: "PENSIONADOS", ronda: rondaActual },
    select: { cliente_id: true },
  });
  const idsAsignados = asignados.map((a) => a.cliente_id);

  const where: Record<string, unknown> = {};
  if (idsAsignados.length > 0) {
    where.id = { notIn: idsAsignados };
  }

  const [zonas, movimientos] = await Promise.all([
    prisma.clientes_pensionados.findMany({
      where,
      select: { zona: true },
      distinct: ["zona"],
      orderBy: { zona: "asc" },
    }),
    prisma.clientes_pensionados.findMany({
      where,
      select: { id_movimiento: true },
      distinct: ["id_movimiento"],
      orderBy: { id_movimiento: "asc" },
    }),
  ]);

  return NextResponse.json({
    zona: zonas.map((z) => z.zona).filter(Boolean),
    id_movimiento: movimientos.map((m) => m.id_movimiento).filter(Boolean),
  });
}
