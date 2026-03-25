import { NextResponse } from "next/server";
import { requireSupervisor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";

export async function GET() {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const userId = Number(session.user.id);

  const poolItems = await prisma.pool_supervisor.findMany({
    where: {
      supervisor_id: userId,
      asignado: false,
      expira_at: { gt: new Date() },
    },
    orderBy: { created_at: "desc" },
    take: 500,
  });

  if (poolItems.length === 0) {
    return NextResponse.json({ items: [], total: 0 });
  }

  // Obtener datos de clientes
  const clienteIds = poolItems.map((p) => p.cliente_id);
  const [clientes, datosContacto] = await Promise.all([
    prismaClientes.clientes.findMany({
      where: { id: { in: clienteIds } },
      select: {
        id: true,
        nss: true,
        curp: true,
        nombres: true,
        a_paterno: true,
        a_materno: true,
        tel_1: true,
        capacidad: true,
        percepciones_fijas: true,
        descuentos_terceros: true,
        filiacion: true,
        convenio: true,
        estado: true,
        municipio: true,
      },
    }),
    prisma.datos_contacto.findMany({
      where: { cliente_id: { in: clienteIds } },
    }),
  ]);

  // Merge datos_contacto
  const clientesMap = new Map(clientes.map((c) => [c.id, { ...c }]));
  for (const dc of datosContacto) {
    const cliente = clientesMap.get(dc.cliente_id);
    if (cliente) {
      (cliente as Record<string, unknown>)[dc.campo] = dc.valor;
    }
  }

  const items = poolItems.map((p) => ({
    id: p.id,
    cliente_id: p.cliente_id,
    expira_at: p.expira_at,
    created_at: p.created_at,
    cliente: clientesMap.get(p.cliente_id) || null,
  }));

  return NextResponse.json({ items, total: items.length });
}
