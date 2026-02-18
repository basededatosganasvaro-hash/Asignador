import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const userId = Number(session!.user.id);
  const rol = session!.user.rol;

  const op = await prisma.oportunidades.findUnique({
    where: { id: Number(id) },
    include: {
      etapa: true,
      historial: {
        include: {
          usuario: { select: { id: true, nombre: true, rol: true } },
          etapa_anterior: { select: { id: true, nombre: true, color: true } },
          etapa_nueva: { select: { id: true, nombre: true, color: true } },
        },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!op) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Solo el dueño, supervisor o admin puede ver esta oportunidad
  const rolesSuperiores = ["admin", "gerente_regional", "gerente_sucursal", "supervisor"];
  if (op.usuario_id !== userId && !rolesSuperiores.includes(rol)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  // Datos del cliente (BD Clientes)
  const cliente = await prismaClientes.clientes.findUnique({
    where: { id: op.cliente_id },
  });

  // Ediciones en BD Sistema
  const ediciones = await prisma.datos_contacto.findMany({
    where: { cliente_id: op.cliente_id },
    orderBy: { created_at: "desc" },
  });
  const editMap: Record<string, string> = {};
  for (const edit of ediciones) {
    if (!editMap[edit.campo]) editMap[edit.campo] = edit.valor;
  }

  const clienteMerged = {
    ...(cliente as object),
    ...editMap,
  };

  // Transiciones disponibles desde la etapa actual
  let transiciones: unknown[] = [];
  if (op.etapa_id) {
    transiciones = await prisma.embudo_transiciones.findMany({
      where: { etapa_origen_id: op.etapa_id, activo: true },
      include: { etapa_destino: { select: { id: true, nombre: true, color: true, tipo: true } } },
    });
  }

  return NextResponse.json({
    ...op,
    cliente: clienteMerged,
    transiciones,
  });
}
