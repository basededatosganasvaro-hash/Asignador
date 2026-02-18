import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const convenio = searchParams.get("convenio");

  if (!convenio) {
    return NextResponse.json({ error: "convenio es requerido" }, { status: 400 });
  }

  const reglas = await prisma.convenio_reglas.findMany({
    where: { convenio },
    orderBy: [{ obligatorio: "desc" }, { campo: "asc" }],
  });

  return NextResponse.json(reglas);
}
