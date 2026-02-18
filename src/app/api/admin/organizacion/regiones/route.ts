import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { createRegionSchema } from "@/lib/validators";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const regiones = await prisma.regiones.findMany({
    include: { _count: { select: { zonas: true, usuarios: true } } },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(regiones);
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = createRegionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const region = await prisma.regiones.create({
    data: { nombre: parsed.data.nombre },
  });

  return NextResponse.json(region, { status: 201 });
}
