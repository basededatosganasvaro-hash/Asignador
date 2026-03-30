import { NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requirePromotor();
  if (error) return error;

  const catalogo = await prisma.catalogo_retroalimentacion.findMany({
    where: { activo: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(catalogo);
}
