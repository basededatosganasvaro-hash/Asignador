import { NextRequest, NextResponse } from "next/server";
import { requireAsistente } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

const AGENTE_API_URL = process.env.AGENTE_API_URL || "http://agente-api.railway.internal:8000";
const AGENTE_API_KEY = process.env.AGENTE_API_KEY || "";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONVERSATIONS = 50;

export async function POST(request: NextRequest) {
  const { session, error } = await requireAsistente();
  if (error) return error;

  const body = await request.json();
  const { mensaje, conversacion_id } = body;

  if (!mensaje || typeof mensaje !== "string" || mensaje.trim().length === 0) {
    return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });
  }

  if (mensaje.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `El mensaje no puede exceder ${MAX_MESSAGE_LENGTH} caracteres` },
      { status: 400 },
    );
  }

  const userId = parseInt(session.user.id);

  // Crear o obtener conversación
  let convId = conversacion_id;
  if (!convId) {
    // Verificar límite de conversaciones activas
    const convCount = await prisma.ia_conversaciones.count({
      where: { usuario_id: userId, activo: true },
    });
    if (convCount >= MAX_CONVERSATIONS) {
      return NextResponse.json(
        { error: `Límite de ${MAX_CONVERSATIONS} conversaciones alcanzado. Elimina alguna para continuar.` },
        { status: 429 },
      );
    }

    const conv = await prisma.ia_conversaciones.create({
      data: {
        usuario_id: userId,
        titulo: mensaje.slice(0, 200),
      },
    });
    convId = conv.id;
  } else {
    // Verificar que la conversación pertenece al usuario
    const conv = await prisma.ia_conversaciones.findFirst({
      where: { id: convId, usuario_id: userId, activo: true },
    });
    if (!conv) {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }
  }

  // Guardar mensaje del usuario
  await prisma.ia_mensajes.create({
    data: {
      conversacion_id: convId,
      rol: "user",
      contenido: mensaje.trim(),
    },
  });

  // Obtener historial reciente para contexto (los 20 más recientes)
  const historial = await prisma.ia_mensajes.findMany({
    where: { conversacion_id: convId },
    orderBy: { created_at: "desc" },
    take: 20,
    select: { rol: true, contenido: true },
  });
  historial.reverse();

  // Forward a agente-api
  const startTime = Date.now();
  let respuestaTexto = "";
  let metadata: Record<string, unknown> = {};

  try {
    const agenteResponse = await fetch(`${AGENTE_API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": AGENTE_API_KEY,
      },
      body: JSON.stringify({
        mensaje: mensaje.trim(),
        historial: historial.map((m) => ({ rol: m.rol, contenido: m.contenido })),
        usuario_id: userId,
      }),
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });

    if (!agenteResponse.ok) {
      throw new Error(`Agente API error: ${agenteResponse.status}`);
    }

    const agenteData = await agenteResponse.json();
    respuestaTexto = agenteData.respuesta || "Sin respuesta del agente.";
    metadata = {
      sql_queries: agenteData.sql_queries || [],
      chart: agenteData.chart || null,
      tokens_used: agenteData.tokens_used || null,
      model: agenteData.model || null,
      duration_ms: Date.now() - startTime,
    };
  } catch (err) {
    // Log internally, return generic message to client
    const duration = Date.now() - startTime;
    console.error("Agente API error:", err instanceof Error ? err.message : "Unknown error");
    respuestaTexto = "El servicio de IA no está disponible en este momento. Por favor intenta de nuevo más tarde.";
    metadata = { error: true, duration_ms: duration };
  }

  // Guardar respuesta del asistente
  const mensajeAsistente = await prisma.ia_mensajes.create({
    data: {
      conversacion_id: convId,
      rol: "assistant",
      contenido: respuestaTexto,
      metadata_json: metadata as object,
    },
  });

  // Actualizar timestamp de conversación
  await prisma.ia_conversaciones.update({
    where: { id: convId },
    data: { updated_at: new Date() },
  });

  return NextResponse.json({
    conversacion_id: convId,
    mensaje: {
      id: mensajeAsistente.id,
      rol: "assistant",
      contenido: respuestaTexto,
      metadata: metadata,
      created_at: mensajeAsistente.created_at,
    },
  });
}
