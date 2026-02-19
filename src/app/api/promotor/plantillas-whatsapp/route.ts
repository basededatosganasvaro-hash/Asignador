import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { WA_MENSAJES_DEFAULT } from "@/lib/whatsapp";

// GET: obtener plantillas del usuario (merge con defaults)
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = Number(session!.user.id);

  const plantillas = await prisma.plantillas_whatsapp.findMany({
    where: { usuario_id: userId },
  });

  // Merge: defaults + personalizadas del usuario
  const resultado: Record<string, string> = { ...WA_MENSAJES_DEFAULT };
  for (const p of plantillas) {
    resultado[p.etapa] = p.mensaje;
  }

  return NextResponse.json(resultado);
}

// PUT: guardar todas las plantillas del usuario
export async function PUT(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = Number(session!.user.id);
  const body = await request.json() as Record<string, string>;

  // Validar que sea un objeto con strings
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Upsert cada etapa
  const ops = Object.entries(body).map(([etapa, mensaje]) =>
    prisma.plantillas_whatsapp.upsert({
      where: { usuario_id_etapa: { usuario_id: userId, etapa } },
      update: { mensaje: String(mensaje) },
      create: { usuario_id: userId, etapa, mensaje: String(mensaje) },
    })
  );

  await prisma.$transaction(ops);

  return NextResponse.json({ success: true });
}
