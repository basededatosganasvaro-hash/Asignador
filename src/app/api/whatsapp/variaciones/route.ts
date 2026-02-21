import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY no configurada");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Rate limiting simple: max 5 llamadas por minuto por usuario
const rateLimitMap = new Map<number, number[]>();

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const windowMs = 60_000; // 1 minuto
  const maxCalls = 5;
  const calls = (rateLimitMap.get(userId) || []).filter((t) => now - t < windowMs);
  if (calls.length >= maxCalls) return false;
  calls.push(now);
  rateLimitMap.set(userId, calls);
  return true;
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  if (!checkRateLimit(Number(session!.user.id))) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Espera un minuto." }, { status: 429 });
  }

  const { mensaje_base, cantidad = 15 } = await req.json();

  if (!mensaje_base || typeof mensaje_base !== "string") {
    return NextResponse.json({ error: "mensaje_base requerido" }, { status: 400 });
  }

  const cant = Math.min(Math.max(Number(cantidad), 1), 30);

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: `Genera ${cant} variaciones de un mensaje WhatsApp. Reglas: mismo significado, varía estructura/saludos/emojis/sinónimos, preserva {nombre} y {promotor} tal cual, español mexicano semi-formal, sin groserías. Responde SOLO un JSON array de strings.`,
        },
        {
          role: "user",
          content: mensaje_base,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "[]";

    // Parsear respuesta JSON
    let variaciones: string[];
    try {
      variaciones = JSON.parse(content);
      if (!Array.isArray(variaciones)) throw new Error("Not an array");
    } catch {
      // Intentar extraer JSON del contenido
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        variaciones = JSON.parse(match[0]);
      } else {
        return NextResponse.json(
          { error: "Error al parsear variaciones de IA" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ variaciones });
  } catch (err) {
    console.error("[Variaciones] OpenAI error:", err);
    return NextResponse.json(
      { error: "Error al generar variaciones" },
      { status: 500 }
    );
  }
}
