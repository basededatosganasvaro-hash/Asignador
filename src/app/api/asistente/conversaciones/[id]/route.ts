import { NextRequest, NextResponse } from "next/server";
import { requireAsistente } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAsistente();
  if (error) return error;

  const { id } = await params;
  const convId = parseInt(id);
  const userId = parseInt(session.user.id);

  const conversacion = await prisma.ia_conversaciones.findFirst({
    where: { id: convId, usuario_id: userId, activo: true },
    include: {
      mensajes: {
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          rol: true,
          contenido: true,
          metadata_json: true,
          created_at: true,
        },
      },
    },
  });

  if (!conversacion) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  return NextResponse.json(conversacion);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAsistente();
  if (error) return error;

  const { id } = await params;
  const convId = parseInt(id);
  const userId = parseInt(session.user.id);

  const conversacion = await prisma.ia_conversaciones.findFirst({
    where: { id: convId, usuario_id: userId, activo: true },
  });

  if (!conversacion) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  // Soft delete
  await prisma.ia_conversaciones.update({
    where: { id: convId },
    data: { activo: false },
  });

  return NextResponse.json({ ok: true });
}
