import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { createSucursalSchema } from "@/lib/validators";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const sucursales = await prisma.sucursales.findMany({
    include: {
      zona: {
        include: { region: { select: { id: true, nombre: true } } },
      },
      _count: { select: { equipos: true, usuarios: true } },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(sucursales);
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = createSucursalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sucursal = await prisma.sucursales.create({
    data: {
      nombre: parsed.data.nombre,
      zona_id: parsed.data.zona_id,
      direccion: parsed.data.direccion,
    },
    include: { zona: { include: { region: { select: { id: true, nombre: true } } } } },
  });

  return NextResponse.json(sucursal, { status: 201 });
}
