import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { waFetch } from "@/lib/wa-service";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const result = await waFetch(`/campaigns?usuario_id=${session!.user.id}`);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const promotorNombre = session!.user.nombre || "";

    // Replace {promotor} in mensaje_base and variaciones before sending to WA service
    if (body.mensaje_base && typeof body.mensaje_base === "string") {
      body.mensaje_base = body.mensaje_base.replace(/\{promotor\}/g, promotorNombre);
    }
    if (Array.isArray(body.variaciones)) {
      body.variaciones = body.variaciones.map((v: string) =>
        typeof v === "string" ? v.replace(/\{promotor\}/g, promotorNombre) : v
      );
    }

    const result = await waFetch("/campaigns", {
      method: "POST",
      body: { ...body, usuario_id: session!.user.id },
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
