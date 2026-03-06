import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const oportunidadId = Number(id);
  if (isNaN(oportunidadId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const userId = Number(session!.user.id);

  // Verificar que la oportunidad pertenece al promotor
  const op = await prisma.oportunidades.findFirst({
    where: { id: oportunidadId, usuario_id: userId, activo: true },
    select: { id: true },
  });

  if (!op) {
    return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
  }

  // Actualizar wa_manual_at y crear historial en paralelo
  const now = new Date();
  await Promise.all([
    prisma.oportunidades.update({
      where: { id: oportunidadId },
      data: { wa_manual_at: now },
    }),
    prisma.historial.create({
      data: {
        oportunidad_id: oportunidadId,
        usuario_id: userId,
        tipo: "WHATSAPP",
        canal: "WHATSAPP",
        nota: "Envio manual WhatsApp",
      },
    }),
  ]);

  return NextResponse.json({ wa_manual_at: now.toISOString() });
}
