import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { nombre, orden, tipo, timer_dias, color, activo } = body;

  if (timer_dias != null && Number(timer_dias) <= 0) {
    return NextResponse.json({ error: "timer_dias debe ser un numero positivo" }, { status: 400 });
  }

  const updated = await prisma.embudo_etapas.update({
    where: { id: Number(id) },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(orden !== undefined && { orden: Number(orden) }),
      ...(tipo !== undefined && { tipo }),
      ...(timer_dias !== undefined && { timer_dias: timer_dias ? Number(timer_dias) : null }),
      ...(color !== undefined && { color }),
      ...(activo !== undefined && { activo }),
    },
  });

  return NextResponse.json(updated);
}
