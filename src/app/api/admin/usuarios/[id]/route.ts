import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { updateUserSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const usuario = await prisma.usuarios.findUnique({
    where: { id: parseInt(id) },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      created_at: true,
    },
  });

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json(usuario);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.nombre) data.nombre = parsed.data.nombre;
  if (parsed.data.email) data.email = parsed.data.email;
  if (parsed.data.rol) data.rol = parsed.data.rol;
  if (parsed.data.activo !== undefined) data.activo = parsed.data.activo;
  if (parsed.data.password) {
    data.password_hash = await bcrypt.hash(parsed.data.password, 10);
  }

  const usuario = await prisma.usuarios.update({
    where: { id: parseInt(id) },
    data,
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      created_at: true,
    },
  });

  return NextResponse.json(usuario);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  await prisma.usuarios.update({
    where: { id: parseInt(id) },
    data: { activo: false },
  });

  return NextResponse.json({ success: true });
}
