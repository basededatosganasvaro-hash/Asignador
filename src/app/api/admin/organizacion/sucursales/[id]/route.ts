import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { z } from "zod";

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
  zona_id: z.number().optional(),
  direccion: z.string().optional(),
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

  const { nombre, activo, zona_id, direccion } = parsed.data;

  const updated = await prisma.sucursales.update({
    where: { id: entityId },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(activo !== undefined && { activo }),
      ...(zona_id !== undefined && { zona_id: Number(zona_id) }),
      ...(direccion !== undefined && { direccion }),
    },
  });

  return NextResponse.json(updated);
}
