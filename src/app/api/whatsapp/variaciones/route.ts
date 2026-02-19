import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { mensaje_base, cantidad = 15 } = await req.json();

  if (!mensaje_base || typeof mensaje_base !== "string") {
    return NextResponse.json({ error: "mensaje_base requerido" }, { status: 400 });
  }

  const cant = Math.min(Math.max(Number(cantidad), 5), 30);

  try {
    const completion = await openai.chat.completions.create({
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
