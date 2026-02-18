import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { nombre, activo, zona_id, direccion } = body;

  const updated = await prisma.sucursales.update({
    where: { id: Number(id) },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(activo !== undefined && { activo }),
      ...(zona_id !== undefined && { zona_id: Number(zona_id) }),
      ...(direccion !== undefined && { direccion }),
    },
  });

  return NextResponse.json(updated);
}
