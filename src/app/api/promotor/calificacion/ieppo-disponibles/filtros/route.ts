import { NextResponse } from "next/server";
import { requireCalificacion } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";

export async function GET() {
  const { error } = await requireCalificacion("IEPPO");
  if (error) return error;

  // Get current round for IEPPO
  const ronda = await prisma.rondas_calificacion.findUnique({ where: { tipo: "IEPPO" } });
  const rondaActual = ronda?.ronda_actual ?? 1;

  // IDs already assigned in this round
  const asignados = await prisma.calificaciones_promotor.findMany({
    where: { tipo: "IEPPO", ronda: rondaActual },
    select: { cliente_id: true },
  });
  const idsAsignados = asignados.map((a) => a.cliente_id);

  const where: Record<string, unknown> = {
    tipo_cliente: "Cartera para calificar IEPPO",
  };
  if (idsAsignados.length > 0) {
    where.id = { notIn: idsAsignados };
  }

  const [convenios, estados] = await Promise.all([
    prismaClientes.clientes.findMany({
      where,
      select: { convenio: true },
      distinct: ["convenio"],
      orderBy: { convenio: "asc" },
    }),
    prismaClientes.clientes.findMany({
      where,
      select: { estado: true },
      distinct: ["estado"],
      orderBy: { estado: "asc" },
    }),
  ]);

  return NextResponse.json({
    convenio: convenios.map((c) => c.convenio).filter(Boolean),
    estado: estados.map((e) => e.estado).filter(Boolean),
  });
}
