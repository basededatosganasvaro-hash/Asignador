import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { nombre, activo, region_id } = body;

  const updated = await prisma.zonas.update({
    where: { id: Number(id) },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(activo !== undefined && { activo }),
      ...(region_id !== undefined && { region_id: Number(region_id) }),
    },
  });

  return NextResponse.json(updated);
}
