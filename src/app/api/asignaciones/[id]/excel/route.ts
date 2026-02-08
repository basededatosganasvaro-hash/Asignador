import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { generateExcelBuffer } from "@/lib/excel";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const asignacionId = parseInt(id);
  const userId = parseInt(session.user.id);

  // 1. Verificar propiedad
  const asignacion = await prisma.asignaciones.findUnique({
    where: { id: asignacionId },
    include: {
      registros: {
        include: {
          cliente: {
            select: {
              nombres: true,
              tel_1: true,
            },
          },
        },
      },
    },
  });

  if (!asignacion) {
    return NextResponse.json({ error: "Asignacion no encontrada" }, { status: 404 });
  }

  if (asignacion.usuario_id !== userId && session.user.rol !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // 2. Verificar que todos los tel_1 estan completos
  const registros = asignacion.registros.map((r) => r.cliente);
  const incomplete = registros.filter(
    (r) => !r.tel_1 || r.tel_1.trim() === ""
  );

  if (incomplete.length > 0) {
    return NextResponse.json(
      {
        error: "No todos los registros tienen telefono",
        faltantes: incomplete.length,
        total: registros.length,
      },
      { status: 400 }
    );
  }

  // 3. Generar Excel
  const buffer = await generateExcelBuffer(registros, asignacionId);

  const fecha = asignacion.fecha_asignacion.toISOString().split("T")[0];

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="asignacion_${asignacionId}_${fecha}.xlsx"`,
    },
  });
}
