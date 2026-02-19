import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { mensaje_base, cantidad = 30 } = await req.json();

  if (!mensaje_base || typeof mensaje_base !== "string") {
    return NextResponse.json({ error: "mensaje_base requerido" }, { status: 400 });
  }

  const cant = Math.min(Math.max(Number(cantidad), 5), 50);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: `Eres un asistente que genera variaciones de mensajes de WhatsApp para vendedores mexicanos.

REGLAS ESTRICTAS:
- Genera exactamente ${cant} variaciones del mensaje proporcionado
- Cada variación debe mantener el MISMO significado e intención
- Varía: estructura de oraciones, saludos, puntuación, emojis, sinónimos
- PRESERVA las variables {nombre} y {promotor} exactamente como están — NO las reemplaces
- Usa español mexicano, tono semi-formal y amigable
- Cada variación debe verse diferente a simple vista (no solo cambiar una palabra)
- No uses malas palabras ni lenguaje ofensivo
- Longitud similar al original (±30%)

FORMATO DE RESPUESTA:
Devuelve SOLO un JSON array de strings, sin explicaciones. Ejemplo:
["variación 1", "variación 2", ...]`,
        },
        {
          role: "user",
          content: `Genera ${cant} variaciones de este mensaje:\n\n${mensaje_base}`,
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
