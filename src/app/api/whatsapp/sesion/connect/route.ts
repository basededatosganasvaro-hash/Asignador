import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { waFetch } from "@/lib/wa-service";

export async function POST() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const userId = Number(session!.user.id);
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: `ID inválido: ${session!.user.id}` }, { status: 400 });
    }
    const result = await waFetch(`/sessions/${userId}/connect`, { method: "POST" });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
