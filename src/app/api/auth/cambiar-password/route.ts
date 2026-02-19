import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = parseInt(session.user.id);
  const body = await req.json();
  const { password_actual, password_nueva } = body;

  if (!password_nueva || password_nueva.length < 6) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const user = await prisma.usuarios.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Si no es cambio obligatorio, verificar contraseña actual
  if (!user.debe_cambiar_password) {
    if (!password_actual) {
      return NextResponse.json(
        { error: "La contraseña actual es requerida" },
        { status: 400 }
      );
    }
    const isValid = await bcrypt.compare(password_actual, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "La contraseña actual es incorrecta" },
        { status: 403 }
      );
    }
  }

  const hash = await bcrypt.hash(password_nueva, 10);

  await prisma.usuarios.update({
    where: { id: userId },
    data: {
      password_hash: hash,
      debe_cambiar_password: false,
    },
  });

  return NextResponse.json({ ok: true });
}
