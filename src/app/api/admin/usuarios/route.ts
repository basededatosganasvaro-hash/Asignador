import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { createUserSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const usuarios = await prisma.usuarios.findMany({
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      created_at: true,
      equipo_id: true,
      sucursal_id: true,
      region_id: true,
      equipo: { select: { id: true, nombre: true } },
      sucursal: { select: { id: true, nombre: true } },
      region: { select: { id: true, nombre: true } },
      _count: { select: { lotes: true, oportunidades: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(usuarios);
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { nombre, email, password, rol, equipo_id, sucursal_id, region_id } = parsed.data;

  const existing = await prisma.usuarios.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese email" },
      { status: 409 }
    );
  }

  const password_hash = await bcrypt.hash(password, 10);

  const usuario = await prisma.usuarios.create({
    data: { nombre, email, password_hash, rol, equipo_id, sucursal_id, region_id },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      created_at: true,
      equipo_id: true,
      sucursal_id: true,
      region_id: true,
    },
  });

  return NextResponse.json(usuario, { status: 201 });
}
