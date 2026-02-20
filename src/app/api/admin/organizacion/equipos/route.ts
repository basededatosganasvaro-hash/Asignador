import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { createEquipoSchema } from "@/lib/validators";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const equipos = await prisma.equipos.findMany({
    include: {
      sucursal: { select: { id: true, nombre: true } },
      supervisor: { select: { id: true, nombre: true } },
      _count: { select: { miembros: true } },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(equipos);
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = createEquipoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const equipo = await prisma.equipos.create({
    data: {
      nombre: parsed.data.nombre,
      sucursal_id: parsed.data.sucursal_id ?? null,
      supervisor_id: parsed.data.supervisor_id,
    },
    include: {
      sucursal: { select: { id: true, nombre: true } },
      supervisor: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json(equipo, { status: 201 });
}
