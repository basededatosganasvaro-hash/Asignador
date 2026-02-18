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
      captacion: { select: { convenio: true, datos_json: true } },
    },
    orderBy: [{ timer_vence: "asc" }, { created_at: "asc" }],
  });

  if (oportunidades.length === 0) return NextResponse.json([]);

  // Fetch client names from BD Clientes (solo para los que tienen cliente_id)
  const clienteIds = oportunidades.map((o) => o.cliente_id).filter((id): id is number => id !== null);

  const clienteMap: Record<number, { id: number; nombres: string | null; convenio: string | null; estado: string | null; municipio: string | null; tipo_cliente: string | null }> = {};

  if (clienteIds.length > 0) {
    const clientes = await prismaClientes.clientes.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, nombres: true, convenio: true, estado: true, municipio: true, tipo_cliente: true },
    });
    for (const c of clientes) clienteMap[c.id] = c;
  }

  // Get last edit for tel_1 (solo clientes de BD Clientes)
  const tel1Map: Record<number, string> = {};
  if (clienteIds.length > 0) {
    const tel1Edits = await prisma.datos_contacto.findMany({
      where: { cliente_id: { in: clienteIds }, campo: "tel_1" },
      orderBy: { created_at: "desc" },
    });
    for (const edit of tel1Edits) {
      if (!tel1Map[edit.cliente_id!]) tel1Map[edit.cliente_id!] = edit.valor;
    }
  }

  const result = oportunidades.map((op) => {
    if (op.cliente_id !== null) {
      const cliente = clienteMap[op.cliente_id];
      return {
        id: op.id,
        cliente_id: op.cliente_id,
        nombres: cliente?.nombres ?? "—",
        convenio: cliente?.convenio ?? "—",
        estado: cliente?.estado ?? "—",
        municipio: cliente?.municipio ?? "—",
        tipo_cliente: cliente?.tipo_cliente ?? "—",
        tel_1: tel1Map[op.cliente_id] ?? null,
        etapa: op.etapa,
        timer_vence: op.timer_vence,
        origen: op.origen,
        created_at: op.created_at,
      };
    } else {
      // Cliente captado — datos desde captacion.datos_json
      const datos = (op.captacion?.datos_json ?? {}) as Record<string, string>;
      const nombres = datos.nombres
        ? `${datos.nombres} ${datos.a_paterno ?? ""} ${datos.a_materno ?? ""}`.trim()
        : `${datos.a_paterno ?? ""} ${datos.a_materno ?? ""}`.trim() || "Sin nombre";
      return {
        id: op.id,
        cliente_id: null,
        nombres,
        convenio: op.captacion?.convenio ?? "—",
        estado: datos.estado ?? "—",
        municipio: datos.municipio ?? "—",
        tipo_cliente: "Captado",
        tel_1: datos.tel_1 ?? null,
        etapa: op.etapa,
        timer_vence: op.timer_vence,
        origen: op.origen,
        created_at: op.created_at,
      };
    }
  });

  return NextResponse.json(result);
}
