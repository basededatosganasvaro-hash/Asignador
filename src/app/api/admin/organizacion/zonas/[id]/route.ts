import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { z } from "zod";

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
  region_id: z.number().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const entityId = parseInt(id);
  if (isNaN(entityId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { nombre, activo, region_id } = parsed.data;

  const updated = await prisma.zonas.update({
    where: { id: entityId },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(activo !== undefined && { activo }),
      ...(region_id !== undefined && { region_id: Number(region_id) }),
    },
  });

  return NextResponse.json(updated);
}
