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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const regla = await prisma.convenio_reglas.findUnique({ where: { id: Number(id) } });
  if (!regla) {
    return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
  }

  // Check if any captaciones use this convenio
  const enUso = await prisma.captaciones.count({ where: { convenio: regla.convenio } });
  if (enUso > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${enUso} captaciones usan el convenio "${regla.convenio}"` },
      { status: 409 }
    );
  }

  await prisma.convenio_reglas.delete({ where: { id: Number(id) } });

  return NextResponse.json({ ok: true });
}
