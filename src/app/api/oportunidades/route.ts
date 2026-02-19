import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = Number(session!.user.id);

  const oportunidades = await prisma.oportunidades.findMany({
    where: {
      usuario_id: userId,
      activo: true,
      // Excluir oportunidades en etapas de salida (datos legacy pre auto-pool)
      OR: [
        { etapa: { tipo: "AVANCE" } },
        { etapa: { tipo: "FINAL", nombre: "Venta" } },
        { etapa_id: null },
      ],
    },
    include: {
      etapa: { select: { id: true, nombre: true, tipo: true, color: true } },
      captacion: { select: { convenio: true, datos_json: true } },
    },
    orderBy: [{ timer_vence: "asc" }, { created_at: "asc" }],
  });

  if (oportunidades.length === 0) return NextResponse.json([]);

  // Fetch ALL client fields from BD Clientes
  const clienteIds = oportunidades.map((o) => o.cliente_id).filter((id): id is number => id !== null);

  const clienteMap: Record<number, Record<string, unknown>> = {};

  if (clienteIds.length > 0) {
    const clientes = await prismaClientes.clientes.findMany({
      where: { id: { in: clienteIds } },
    });
    for (const c of clientes) clienteMap[c.id] = c as unknown as Record<string, unknown>;
  }

  // Get all contact edits (datos_contacto) for these clients
  const editMap: Record<number, Record<string, string>> = {};
  if (clienteIds.length > 0) {
    const edits = await prisma.datos_contacto.findMany({
      where: { cliente_id: { in: clienteIds } },
      orderBy: { created_at: "desc" },
    });
    for (const edit of edits) {
      if (!editMap[edit.cliente_id]) editMap[edit.cliente_id] = {};
      if (!editMap[edit.cliente_id][edit.campo]) {
        editMap[edit.cliente_id][edit.campo] = edit.valor;
      }
    }
  }

  const result = oportunidades.map((op) => {
    if (op.cliente_id !== null) {
      const cliente = clienteMap[op.cliente_id] ?? {};
      const edits = editMap[op.cliente_id] ?? {};
      // Merge: edits override original client data
      const merged = { ...cliente, ...edits };
      return {
        id: op.id,
        cliente_id: op.cliente_id,
        etapa: op.etapa,
        timer_vence: op.timer_vence,
        origen: op.origen,
        num_operacion: op.num_operacion ?? null,
        created_at: op.created_at,
        // All client fields (flat)
        ...merged,
        // Ensure key display fields have fallbacks
        nombres: (merged.nombres as string) ?? "—",
        convenio: (merged.convenio as string) ?? "—",
        estado: (merged.estado as string) ?? "—",
        municipio: (merged.municipio as string) ?? "—",
        tipo_cliente: (merged.tipo_cliente as string) ?? "—",
        tel_1: (merged.tel_1 as string) ?? null,
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
        etapa: op.etapa,
        timer_vence: op.timer_vence,
        origen: op.origen,
        num_operacion: op.num_operacion ?? null,
        created_at: op.created_at,
        ...datos,
        nombres,
        convenio: op.captacion?.convenio ?? "—",
        estado: datos.estado ?? "—",
        municipio: datos.municipio ?? "—",
        tipo_cliente: "Captado",
        tel_1: datos.tel_1 ?? null,
      };
    }
  });

  return NextResponse.json(result);
}
