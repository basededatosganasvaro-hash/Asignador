import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { updateUserSchema } from "@/lib/validators";
import { serializeBigInt } from "@/lib/utils";
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
      equipo_id: true,
      sucursal_id: true,
      region_id: true,
      equipo: { select: { id: true, nombre: true } },
      sucursal: { select: { id: true, nombre: true } },
      region: { select: { id: true, nombre: true } },
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
  if (parsed.data.nombre !== undefined) data.nombre = parsed.data.nombre;
  if (parsed.data.username !== undefined) data.username = parsed.data.username;
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.rol !== undefined) data.rol = parsed.data.rol;
  if (parsed.data.activo !== undefined) data.activo = parsed.data.activo;
  if (parsed.data.equipo_id !== undefined) data.equipo_id = parsed.data.equipo_id;
  if (parsed.data.sucursal_id !== undefined) data.sucursal_id = parsed.data.sucursal_id;
  if (parsed.data.region_id !== undefined) data.region_id = parsed.data.region_id;
  if (parsed.data.telegram_id !== undefined) data.telegram_id = parsed.data.telegram_id ? BigInt(parsed.data.telegram_id) : null;
  if (parsed.data.password) {
    const hashed = await bcrypt.hash(parsed.data.password, 10);
    console.log(`[PASSWORD RESET] Usuario ID=${id} — hash generado: ${hashed.substring(0, 20)}...`);
    data.password_hash = hashed;
    data.debe_cambiar_password = true; // Forzar cambio en próximo login
    data.intentos_fallidos = 0;
    data.bloqueado_hasta = null;
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
      equipo_id: true,
      sucursal_id: true,
      region_id: true,
      telegram_id: true,
      password_hash: true,
    },
  });

  if (parsed.data.password) {
    console.log(`[PASSWORD RESET] Usuario ID=${id} — UPDATE exitoso, hash en BD: ${usuario.password_hash.substring(0, 20)}...`);
  }

  // No exponer password_hash en la respuesta
  const { password_hash: _, ...usuarioSinHash } = usuario;
  return NextResponse.json(serializeBigInt(usuarioSinHash));
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
