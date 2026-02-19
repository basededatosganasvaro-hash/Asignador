import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { waFetch } from "@/lib/wa-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const result = await waFetch(`/campaigns/${id}`);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { action } = await req.json(); // "pause" | "resume" | "cancel"

  if (!["pause", "resume", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  try {
    const result = await waFetch(`/campaigns/${id}/${action}`, { method: "PATCH" });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
