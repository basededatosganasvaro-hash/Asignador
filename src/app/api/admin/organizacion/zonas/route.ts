import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { createZonaSchema } from "@/lib/validators";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const zonas = await prisma.zonas.findMany({
    include: {
      region: { select: { id: true, nombre: true } },
      _count: { select: { sucursales: true } },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(zonas);
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = createZonaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const zona = await prisma.zonas.create({
    data: { nombre: parsed.data.nombre, region_id: parsed.data.region_id },
    include: { region: { select: { id: true, nombre: true } } },
  });

  return NextResponse.json(zona, { status: 201 });
}
