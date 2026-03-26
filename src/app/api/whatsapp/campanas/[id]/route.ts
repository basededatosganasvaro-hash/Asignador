import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { waFetch } from "@/lib/wa-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // H14: Validar que id sea numérico para prevenir path traversal
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const result = await waFetch<Record<string, unknown>>(`/campaigns/${id}`);
    // H13: Verificar ownership siempre — si no viene usuario_id, denegar acceso
    if (!result || !result.usuario_id || result.usuario_id !== Number(session!.user.id)) {
      return NextResponse.json({ error: "Sin acceso a esta campaña" }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al obtener campaña" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // H14: Validar que id sea numérico
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { action } = await req.json(); // "pause" | "resume" | "cancel"

  if (!["pause", "resume", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  try {
    // H13: Verificar ownership — denegar si no viene usuario_id
    const campaign = await waFetch<Record<string, unknown>>(`/campaigns/${id}`);
    if (!campaign || !campaign.usuario_id || campaign.usuario_id !== Number(session!.user.id)) {
      return NextResponse.json({ error: "Sin acceso a esta campaña" }, { status: 403 });
    }

    const result = await waFetch(`/campaigns/${id}/${action}`, { method: "PATCH" });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al actualizar campaña" }, { status: 500 });
  }
}
