import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { nombre_accion, requiere_nota, requiere_supervisor, devuelve_al_pool, activo } = body;

  const updated = await prisma.embudo_transiciones.update({
    where: { id: Number(id) },
    data: {
      ...(nombre_accion !== undefined && { nombre_accion }),
      ...(requiere_nota !== undefined && { requiere_nota }),
      ...(requiere_supervisor !== undefined && { requiere_supervisor }),
      ...(devuelve_al_pool !== undefined && { devuelve_al_pool }),
      ...(activo !== undefined && { activo }),
    },
    include: {
      etapa_origen: { select: { id: true, nombre: true, color: true } },
      etapa_destino: { select: { id: true, nombre: true, color: true } },
    },
  });

  return NextResponse.json(updated);
}
