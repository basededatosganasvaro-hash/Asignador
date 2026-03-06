import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const etapas = await prisma.embudo_etapas.findMany({
    orderBy: { orden: "asc" },
    include: {
      _count: { select: { transiciones_origen: true, oportunidades: true } },
    },
  });

  return NextResponse.json(etapas);
}

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { nombre, orden, tipo, timer_dias, color } = body;

  if (!nombre || !orden || !tipo || !color) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  if (timer_dias != null && Number(timer_dias) <= 0) {
    return NextResponse.json({ error: "timer_dias debe ser un numero positivo" }, { status: 400 });
  }

  const etapa = await prisma.embudo_etapas.create({
    data: { nombre, orden: Number(orden), tipo, timer_dias: timer_dias ? Number(timer_dias) : null, color },
  });

  return NextResponse.json(etapa, { status: 201 });
}
