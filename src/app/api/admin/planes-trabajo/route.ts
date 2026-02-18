import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { createPlanTrabajoSchema } from "@/lib/validators";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const planes = await prisma.planes_trabajo.findMany({
    include: {
      sucursal: { select: { id: true, nombre: true } },
      creador: { select: { id: true, nombre: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(planes);
}

export async function POST(request: Request) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = createPlanTrabajoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const plan = await prisma.planes_trabajo.create({
    data: {
      sucursal_id: parsed.data.sucursal_id,
      convenio: parsed.data.convenio,
      creado_por: parseInt(session!.user.id),
    },
    include: {
      sucursal: { select: { id: true, nombre: true } },
      creador: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json(plan, { status: 201 });
}

export async function DELETE(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Se requiere id" }, { status: 400 });
  }

  await prisma.planes_trabajo.update({
    where: { id: parseInt(id) },
    data: { activo: false },
  });

  return NextResponse.json({ success: true });
}
