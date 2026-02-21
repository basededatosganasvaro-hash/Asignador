import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { waFetch } from "@/lib/wa-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const result = await waFetch<Record<string, unknown>>(`/campaigns/${id}`);
    // Verificar ownership: la campaña debe pertenecer al usuario autenticado
    if (result && result.usuario_id && result.usuario_id !== Number(session!.user.id)) {
      return NextResponse.json({ error: "Sin acceso a esta campaña" }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { action } = await req.json(); // "pause" | "resume" | "cancel"

  if (!["pause", "resume", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  try {
    // Verificar ownership antes de ejecutar la acción
    const campaign = await waFetch<Record<string, unknown>>(`/campaigns/${id}`);
    if (campaign && campaign.usuario_id && campaign.usuario_id !== Number(session!.user.id)) {
      return NextResponse.json({ error: "Sin acceso a esta campaña" }, { status: 403 });
    }

    const result = await waFetch(`/campaigns/${id}/${action}`, { method: "PATCH" });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
