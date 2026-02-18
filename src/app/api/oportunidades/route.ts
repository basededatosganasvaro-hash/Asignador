import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = Number(session!.user.id);

  const oportunidades = await prisma.oportunidades.findMany({
    where: { usuario_id: userId, activo: true },
    include: {
      etapa: { select: { id: true, nombre: true, tipo: true, color: true } },
    },
    orderBy: [{ timer_vence: "asc" }, { created_at: "asc" }],
  });

  if (oportunidades.length === 0) return NextResponse.json([]);

  // Fetch client names from BD Clientes
  const clienteIds = oportunidades.map((o) => o.cliente_id);
  const clientes = await prismaClientes.clientes.findMany({
    where: { id: { in: clienteIds } },
    select: { id: true, nombres: true, convenio: true, estado: true, municipio: true },
  });
  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c]));

  // Get last edit for tel_1
  const tel1Edits = await prisma.datos_contacto.findMany({
    where: { cliente_id: { in: clienteIds }, campo: "tel_1" },
    orderBy: { created_at: "desc" },
  });
  const tel1Map: Record<number, string> = {};
  for (const edit of tel1Edits) {
    if (!tel1Map[edit.cliente_id]) tel1Map[edit.cliente_id] = edit.valor;
  }

  const result = oportunidades.map((op) => {
    const cliente = clienteMap[op.cliente_id];
    return {
      id: op.id,
      cliente_id: op.cliente_id,
      nombres: cliente?.nombres ?? "—",
      convenio: cliente?.convenio ?? "—",
      estado: cliente?.estado ?? "—",
      municipio: cliente?.municipio ?? "—",
      tel_1: tel1Map[op.cliente_id] ?? null,
      etapa: op.etapa,
      timer_vence: op.timer_vence,
      origen: op.origen,
      created_at: op.created_at,
    };
  });

  return NextResponse.json(result);
}
