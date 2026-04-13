import { NextResponse } from "next/server";
import { requireCalificacion } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireCalificacion("CDMX");
  if (error) return error;

  const { id } = await params;
  const clienteId = Number(id);
  if (isNaN(clienteId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const cliente = await prisma.clientes_cdmx.findUnique({
    where: { id: clienteId },
  });

  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ...cliente,
    valor_original: cliente.valor_original?.toString() ?? null,
    valor_enviado: cliente.valor_enviado?.toString() ?? null,
    valor_descontado: cliente.valor_descontado?.toString() ?? null,
  });
}
