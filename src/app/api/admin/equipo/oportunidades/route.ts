import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireSupervisorOrAdmin } from "@/lib/auth-utils";

export async function GET() {
  const { session, error } = await requireSupervisorOrAdmin();
  if (error) return error;

  const userId = Number(session!.user.id);
  const rol = session!.user.rol;

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
    where: { activo: true, ...equipoFilter },
    include: {
      etapa: { select: { id: true, nombre: true, color: true, tipo: true } },
      usuario: { select: { id: true, nombre: true } },
      captacion: { select: { convenio: true, datos_json: true } },
    },
    orderBy: { updated_at: "desc" },
  });

  if (oportunidades.length === 0) return NextResponse.json([]);

  const clienteIds = oportunidades.map((o) => o.cliente_id).filter((id): id is number => id !== null);
  const clienteMap: Record<number, { id: number; nombres: string | null; convenio: string | null }> = {};

  if (clienteIds.length > 0) {
    const clientes = await prismaClientes.clientes.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, nombres: true, convenio: true },
    });
    for (const c of clientes) clienteMap[c.id] = c;
  }

  const result = oportunidades.map((op) => {
    let nombres = "—", convenio = "—";
    if (op.cliente_id !== null) {
      nombres = clienteMap[op.cliente_id]?.nombres ?? "—";
      convenio = clienteMap[op.cliente_id]?.convenio ?? "—";
    } else if (op.captacion) {
      const datos = op.captacion.datos_json as Record<string, string>;
      nombres = datos.nombres
        ? `${datos.nombres} ${datos.a_paterno ?? ""} ${datos.a_materno ?? ""}`.trim()
        : `${datos.a_paterno ?? ""} ${datos.a_materno ?? ""}`.trim() || "Sin nombre";
      convenio = op.captacion.convenio;
    }
    return {
      id: op.id,
      cliente_id: op.cliente_id,
      nombres,
      convenio,
      etapa: op.etapa,
      promotor: op.usuario,
      timer_vence: op.timer_vence,
      updated_at: op.updated_at,
    };
  });

  return NextResponse.json(result);
}
