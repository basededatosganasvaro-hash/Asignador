import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { waFetch } from "@/lib/wa-service";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const userId = Number(session!.user.id);
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: "ID de usuario inválido" }, { status: 400 });
    }
    const result = await waFetch(`/sessions/${userId}/status`);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al consultar estado de sesión" }, { status: 500 });
  }
}
