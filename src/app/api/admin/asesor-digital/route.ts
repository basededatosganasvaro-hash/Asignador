import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const registros = await prisma.ad_registros.findMany({
    where: { activo: true },
    include: {
      usuario: { select: { id: true, nombre: true, username: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(registros);
}
