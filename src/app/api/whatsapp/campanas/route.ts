import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { waFetch } from "@/lib/wa-service";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const result = await waFetch(`/campaigns?usuario_id=${session!.user.id}`);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al obtener campañas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const promotorNombre = session!.user.nombre || "";

    // Validar campos requeridos
    if (!body.mensaje_base || typeof body.mensaje_base !== "string") {
      return NextResponse.json({ error: "mensaje_base es requerido y debe ser texto" }, { status: 400 });
    }
    if (!Array.isArray(body.destinatarios) || body.destinatarios.length === 0) {
      return NextResponse.json({ error: "destinatarios es requerido" }, { status: 400 });
    }

    // Replace {promotor} in mensaje_base and variaciones before sending to WA service
    const mensajeBase = body.mensaje_base.replace(/\{promotor\}/g, promotorNombre);
    const variaciones = Array.isArray(body.variaciones)
      ? body.variaciones.filter((v: unknown) => typeof v === "string").map((v: string) => v.replace(/\{promotor\}/g, promotorNombre))
      : undefined;

    // Filtrar solo campos esperados del body
    const payload = {
      nombre: typeof body.nombre === "string" ? body.nombre : undefined,
      mensaje_base: mensajeBase,
      variaciones,
      destinatarios: body.destinatarios,
      usuario_id: session!.user.id,
    };

    const result = await waFetch("/campaigns", {
      method: "POST",
      body: payload,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al crear campaña" }, { status: 500 });
  }
}
