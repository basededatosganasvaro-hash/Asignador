import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGerente } from "@/lib/auth-utils";

/**
 * GET /api/gerente/pool-analista/promotores
 * Lista ligera de promotores activos en la región/sucursal del gerente (para dropdown de asignación).
 */
export async function GET() {
  const { error, scopeFilter } = await requireGerente();
  if (error) return error;

  const promotores = await prisma.usuarios.findMany({
    where: {
      rol: "promotor",
      activo: true,
      [scopeFilter!.field]: scopeFilter!.value,
    },
    select: { id: true, nombre: true, username: true },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(promotores);
}
