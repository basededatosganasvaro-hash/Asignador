import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { z } from "zod";

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
  sucursal_id: z.number().nullable().optional(),
  supervisor_id: z.number().nullable().optional(),
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

  const { nombre, activo, sucursal_id, supervisor_id } = parsed.data;

  const updated = await prisma.equipos.update({
    where: { id: entityId },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(activo !== undefined && { activo }),
      ...(sucursal_id !== undefined && { sucursal_id: sucursal_id ? Number(sucursal_id) : null }),
      ...(supervisor_id !== undefined && { supervisor_id: supervisor_id ? Number(supervisor_id) : null }),
    },
  });

  return NextResponse.json(updated);
}
