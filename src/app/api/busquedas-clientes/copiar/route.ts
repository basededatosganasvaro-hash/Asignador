import { NextResponse } from "next/server";
import { requirePromotorOrSupervisor } from "@/lib/auth-utils";
import { copiarBusquedaSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { session, error } = await requirePromotorOrSupervisor();
  if (error) return error;

  let body;
  try {
    body = copiarBusquedaSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const userId = Number(session.user.id);

  // Verificar que la busqueda existe y pertenece al usuario
  const busqueda = await prisma.busquedas_clientes.findFirst({
    where: { id: body.busqueda_id, usuario_id: userId },
  });

  if (!busqueda) {
    return NextResponse.json({ error: "Busqueda no encontrada" }, { status: 404 });
  }

  await prisma.busquedas_clientes_logs.create({
    data: {
      busqueda_id: body.busqueda_id,
      usuario_id: userId,
      cliente_id: body.cliente_id,
      campo: body.campo,
    },
  });

  return NextResponse.json({ ok: true });
}
