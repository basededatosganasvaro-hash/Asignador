import { NextResponse } from "next/server";
import { requireCalificacion } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireCalificacion("CDMX");
  if (error) return error;

  // Get current round for CDMX
  const ronda = await prisma.rondas_calificacion.findUnique({ where: { tipo: "CDMX" } });
  const rondaActual = ronda?.ronda_actual ?? 1;

  // IDs already assigned in this round
  const asignados = await prisma.calificaciones_promotor.findMany({
    where: { tipo: "CDMX", ronda: rondaActual },
    select: { cliente_id: true },
  });
  const idsAsignados = asignados.map((a) => a.cliente_id);

  const where: Record<string, unknown> = {};
  if (idsAsignados.length > 0) {
    where.id = { notIn: idsAsignados };
  }

  // Fetch distinct values for each filterable column
  const [instituciones, puestos, servicios] = await Promise.all([
    prisma.clientes_cdmx.findMany({
      where,
      select: { institucion: true },
      distinct: ["institucion"],
      orderBy: { institucion: "asc" },
    }),
    prisma.clientes_cdmx.findMany({
      where,
      select: { puesto: true },
      distinct: ["puesto"],
      orderBy: { puesto: "asc" },
    }),
    prisma.clientes_cdmx.findMany({
      where,
      select: { servicio: true },
      distinct: ["servicio"],
      orderBy: { servicio: "asc" },
    }),
  ]);

  return NextResponse.json({
    institucion: instituciones.map((i) => i.institucion).filter(Boolean),
    puesto: puestos.map((p) => p.puesto).filter(Boolean),
    servicio: servicios.map((s) => s.servicio).filter(Boolean),
  });
}
