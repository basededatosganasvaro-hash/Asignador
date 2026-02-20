import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { updateConfigSchema } from "@/lib/validators";
import { invalidateConfig } from "@/lib/config-cache";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const config = await prisma.configuracion.findMany();
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = updateConfigSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { clave, valor } = parsed.data;

  const config = await prisma.configuracion.upsert({
    where: { clave },
    update: { valor },
    create: { clave, valor },
  });

  // Invalidate cached value so changes propagate immediately in this instance
  invalidateConfig(clave);

  return NextResponse.json(config);
}
