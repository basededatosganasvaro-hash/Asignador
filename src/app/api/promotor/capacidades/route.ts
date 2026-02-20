import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaCapacidades } from "@/lib/prisma-capacidades";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = Number(session.user.id);

  // Obtener telegram_id del usuario actual
  const usuario = await prisma.usuarios.findUnique({
    where: { id: userId },
    select: { telegram_id: true },
  });

  if (!usuario?.telegram_id) {
    return NextResponse.json({
      solicitudes: [],
      mensaje: "Sin Telegram vinculado",
    });
  }

  // Query BD Capacidades: solicitudes respondidas
  const solicitudes = await prismaCapacidades.solicitudes.findMany({
    where: {
      user_id: usuario.telegram_id,
      estado: "respondida",
    },
    select: {
      id: true,
      convenio: true,
      nombre_cliente: true,
      nss: true,
      curp: true,
      rfc: true,
      numero_empleado: true,
      fecha_solicitud: true,
      imss_capacidad_actual: true,
      imss_num_creditos: true,
      imss_telefonos: true,
      respuesta: true,
    },
    orderBy: { fecha_solicitud: "desc" },
  });

  return NextResponse.json({ solicitudes });
}
