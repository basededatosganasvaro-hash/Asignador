import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const reglas = await prisma.convenio_reglas.findMany({
    orderBy: [{ convenio: "asc" }, { campo: "asc" }],
  });

  return NextResponse.json(reglas);
}

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { convenio, campo, obligatorio } = await req.json();

  if (!convenio || !campo) {
    return NextResponse.json({ error: "convenio y campo son requeridos" }, { status: 400 });
  }

  const regla = await prisma.convenio_reglas.upsert({
    where: { convenio_campo: { convenio, campo } },
    update: { obligatorio: obligatorio ?? true },
    create: { convenio, campo, obligatorio: obligatorio ?? true },
  });

  return NextResponse.json(regla, { status: 201 });
}
