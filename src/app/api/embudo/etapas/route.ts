import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

/** GET /api/embudo/etapas — etapas activas con transiciones (no supervisor) */
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const etapas = await prisma.embudo_etapas.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
    select: {
      id: true,
      nombre: true,
      orden: true,
      tipo: true,
      color: true,
      transiciones_origen: {
        where: { activo: true, requiere_supervisor: false },
        select: {
          id: true,
          nombre_accion: true,
          requiere_nota: true,
          devuelve_al_pool: true,
          etapa_destino: {
            select: { id: true, nombre: true, color: true, tipo: true },
          },
        },
      },
    },
  });

  return NextResponse.json(etapas);
}
