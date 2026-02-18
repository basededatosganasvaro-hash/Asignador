import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireSupervisorOrAdmin } from "@/lib/auth-utils";

export async function GET() {
  const { session, error } = await requireSupervisorOrAdmin();
  if (error) return error;

  const userId = Number(session!.user.id);
  const rol = session!.user.rol;

  // Scope: supervisor solo ve su equipo, admin ve todo
  let equipoFilter = {};
  if (rol === "supervisor") {
    const sup = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { equipo_id: true },
    });
    if (sup?.equipo_id) {
      equipoFilter = { usuario: { equipo_id: sup.equipo_id } };
    }
  }

  const oportunidades = await prisma.oportunidades.findMany({
    where: {
      activo: true,
      etapa: { tipo: "SALIDA" },
      ...equipoFilter,
    },
    include: {
      etapa: { select: { id: true, nombre: true, color: true, tipo: true } },
      usuario: { select: { id: true, nombre: true } },
    },
    orderBy: { updated_at: "asc" },
  });

  if (oportunidades.length === 0) return NextResponse.json([]);

  // Enriquecer con datos de BD Clientes
  const clienteIds = oportunidades.map((o) => o.cliente_id);
  const clientes = await prismaClientes.clientes.findMany({
    where: { id: { in: clienteIds } },
    select: { id: true, nombres: true, convenio: true, estado: true, municipio: true },
  });
  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c]));

  const result = oportunidades.map((op) => ({
    id: op.id,
    cliente_id: op.cliente_id,
    nombres: clienteMap[op.cliente_id]?.nombres ?? "—",
    convenio: clienteMap[op.cliente_id]?.convenio ?? "—",
    estado: clienteMap[op.cliente_id]?.estado ?? "—",
    municipio: clienteMap[op.cliente_id]?.municipio ?? "—",
    etapa: op.etapa,
    promotor: op.usuario,
    timer_vence: op.timer_vence,
    updated_at: op.updated_at,
  }));

  return NextResponse.json(result);
}
