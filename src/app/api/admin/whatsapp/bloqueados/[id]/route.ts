import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const idNum = Number(id);
  if (!idNum) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    await prisma.wa_contactos_bloqueados.delete({ where: { id: idNum } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo desbloquear" }, { status: 500 });
  }
}
