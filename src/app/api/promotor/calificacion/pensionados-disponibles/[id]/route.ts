import { NextResponse } from "next/server";
import { requireCalificacion } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireCalificacion("PENSIONADOS");
  if (error) return error;

  const { id } = await params;
  const clienteId = Number(id);
  if (isNaN(clienteId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const cliente = await prisma.clientes_pensionados.findUnique({
    where: { id: clienteId },
  });

  if (!cliente) {
    return NextResponse.json({ error: "Pensionado no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ...cliente,
    imp_prestamo: cliente.imp_prestamo?.toString() ?? null,
    imp_mensual: cliente.imp_mensual?.toString() ?? null,
    imp_saldo_pendiente: cliente.imp_saldo_pendiente?.toString() ?? null,
    imp_real_prestamo: cliente.imp_real_prestamo?.toString() ?? null,
    num_tasa_int_anual: cliente.num_tasa_int_anual?.toString() ?? null,
    cat_prestamo: cliente.cat_prestamo?.toString() ?? null,
    tasa_efectiva: cliente.tasa_efectiva?.toString() ?? null,
    tasa_efec_redondeada: cliente.tasa_efec_redondeada?.toString() ?? null,
  });
}
