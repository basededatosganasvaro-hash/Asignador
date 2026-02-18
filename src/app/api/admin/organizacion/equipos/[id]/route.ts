import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { nombre, activo, sucursal_id, supervisor_id } = body;

  const updated = await prisma.equipos.update({
    where: { id: Number(id) },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(activo !== undefined && { activo }),
      ...(sucursal_id !== undefined && { sucursal_id: Number(sucursal_id) }),
      ...(supervisor_id !== undefined && { supervisor_id: supervisor_id ? Number(supervisor_id) : null }),
    },
  });

  return NextResponse.json(updated);
}
