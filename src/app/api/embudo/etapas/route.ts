import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

/** GET /api/embudo/etapas — todas las etapas activas en orden */
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const etapas = await prisma.embudo_etapas.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
    select: { id: true, nombre: true, orden: true, tipo: true, color: true },
  });

  return NextResponse.json(etapas);
}
