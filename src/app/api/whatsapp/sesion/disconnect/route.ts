import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { waFetch } from "@/lib/wa-service";

export async function POST() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const result = await waFetch(`/sessions/${session!.user.id}`, { method: "DELETE" });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al desconectar sesión WhatsApp" }, { status: 500 });
  }
}
