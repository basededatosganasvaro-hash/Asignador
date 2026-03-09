import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAsesorDigital } from "@/lib/auth-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  const { id } = await params;
  const userId = Number(session.user.id);

  const registro = await prisma.ad_redes_sociales.findFirst({
    where: { id: Number(id), usuario_id: userId, activo: true },
  });

  if (!registro) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  // Transaction: create in ad_registros + soft-delete from ad_redes_sociales
  const nuevoRegistro = await prisma.$transaction(async (tx) => {
    const created = await tx.ad_registros.create({
      data: {
        usuario_id: userId,
        etapa: "Leads",
        nombre_cliente: registro.nombre_cliente,
        fecha: registro.fecha,
        status: registro.status === "Venta" ? "Venta"
          : registro.status === "Interesado" ? "Interesado"
          : registro.status === "Cotizacion" ? "Cotizacion"
          : registro.status === "No interesado" || registro.status === "No apto" || registro.status === "No localizado" ? "No viable"
          : registro.status === "En proceso" ? "Proceso"
          : "Sin informacion",
        estrategia: registro.estrategia || null,
        numero_telefono: registro.numero_telefono || null,
        curp: registro.curp || null,
        viabilidad: registro.viabilidad || null,
        motivo: registro.motivo || null,
      },
    });

    await tx.ad_redes_sociales.update({
      where: { id: registro.id },
      data: { activo: false },
    });

    return created;
  });

  return NextResponse.json(nuevoRegistro, { status: 201 });
}
