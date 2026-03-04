import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

/**
 * GET /api/admin/usuarios/promotores
 * Retorna lista ligera de promotores activos para dropdown de beta testers.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const promotores = await prisma.usuarios.findMany({
    where: { rol: "promotor", activo: true },
    select: { id: true, nombre: true, username: true },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(promotores);
}
