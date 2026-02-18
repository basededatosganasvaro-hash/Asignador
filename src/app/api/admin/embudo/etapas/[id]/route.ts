import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { nombre, orden, tipo, timer_horas, color, activo } = body;

  const updated = await prisma.embudo_etapas.update({
    where: { id: Number(id) },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(orden !== undefined && { orden: Number(orden) }),
      ...(tipo !== undefined && { tipo }),
      ...(timer_horas !== undefined && { timer_horas: timer_horas ? Number(timer_horas) : null }),
      ...(color !== undefined && { color }),
      ...(activo !== undefined && { activo }),
    },
  });

  return NextResponse.json(updated);
}
