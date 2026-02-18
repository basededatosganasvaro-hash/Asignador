import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const transiciones = await prisma.embudo_transiciones.findMany({
    orderBy: { etapa_origen_id: "asc" },
    include: {
      etapa_origen: { select: { id: true, nombre: true, color: true } },
      etapa_destino: { select: { id: true, nombre: true, color: true } },
    },
  });

  return NextResponse.json(transiciones);
}

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { etapa_origen_id, etapa_destino_id, nombre_accion, requiere_nota, requiere_supervisor, devuelve_al_pool } = body;

  if (!etapa_origen_id || !nombre_accion) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const transicion = await prisma.embudo_transiciones.create({
    data: {
      etapa_origen_id: Number(etapa_origen_id),
      etapa_destino_id: etapa_destino_id ? Number(etapa_destino_id) : null,
      nombre_accion,
      requiere_nota: requiere_nota ?? true,
      requiere_supervisor: requiere_supervisor ?? false,
      devuelve_al_pool: devuelve_al_pool ?? false,
    },
    include: {
      etapa_origen: { select: { id: true, nombre: true, color: true } },
      etapa_destino: { select: { id: true, nombre: true, color: true } },
    },
  });

  return NextResponse.json(transicion, { status: 201 });
}
