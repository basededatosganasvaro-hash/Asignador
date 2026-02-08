import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const asignacionId = parseInt(id);
  const userId = parseInt(session.user.id);

  const asignacion = await prisma.asignaciones.findUnique({
    where: { id: asignacionId },
    include: {
      registros: {
        include: {
          cliente: {
            select: {
              id: true,
              nombres: true,
              tel_1: true,
              tel_2: true,
              tel_3: true,
              tel_4: true,
              tel_5: true,
              curp: true,
              rfc: true,
              num_empleado: true,
              estado: true,
              municipio: true,
              convenio: true,
              oferta: true,
            },
          },
        },
      },
    },
  });

  if (!asignacion) {
    return NextResponse.json({ error: "Asignacion no encontrada" }, { status: 404 });
  }

  // Verificar que el usuario es dueno o es admin
  if (asignacion.usuario_id !== userId && session.user.rol !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const registros = asignacion.registros.map((r) => r.cliente);
  const registrosConTel1 = registros.filter(
    (c) => c.tel_1 && c.tel_1.trim() !== ""
  ).length;

  return NextResponse.json({
    id: asignacion.id,
    fecha_asignacion: asignacion.fecha_asignacion,
    cantidad_registros: asignacion.cantidad_registros,
    estado: asignacion.estado,
    registros_con_tel1: registrosConTel1,
    puede_descargar: registrosConTel1 === asignacion.cantidad_registros && asignacion.cantidad_registros > 0,
    registros,
  });
}
