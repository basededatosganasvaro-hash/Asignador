import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { obligatorio } = await req.json();

  const regla = await prisma.convenio_reglas.update({
    where: { id: Number(id) },
    data: { obligatorio },
  });

  return NextResponse.json(regla);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  await prisma.convenio_reglas.delete({ where: { id: Number(id) } });

  return NextResponse.json({ ok: true });
}
