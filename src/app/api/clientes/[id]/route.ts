import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { updateClienteSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const clienteId = parseInt(id);
  const userId = parseInt(session.user.id);

  // 1. Verificar que el cliente esta asignado a este usuario
  const link = await prisma.asignacion_registros.findUnique({
    where: { cliente_id: clienteId },
    include: { asignacion: true },
  });

  if (!link || link.asignacion.usuario_id !== userId) {
    return NextResponse.json(
      { error: "No tienes permiso para editar este registro" },
      { status: 403 }
    );
  }

  // 2. Parsear body
  const body = await request.json();
  const parsed = updateClienteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 3. Obtener el cliente actual para validar campos condicionales
  const cliente = await prisma.clientes.findUnique({
    where: { id: clienteId },
  });

  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  // 4. Construir datos de actualizacion con reglas de campo
  const updateData: Record<string, string> = {};

  if (parsed.data.tel_1 !== undefined) {
    updateData.tel_1 = parsed.data.tel_1;
  }

  if (parsed.data.num_empleado !== undefined) {
    updateData.num_empleado = parsed.data.num_empleado;
  }

  if (parsed.data.curp !== undefined) {
    if (cliente.curp && cliente.curp.trim() !== "") {
      return NextResponse.json(
        { error: "CURP ya tiene un valor y no se puede sobrescribir" },
        { status: 400 }
      );
    }
    updateData.curp = parsed.data.curp;
  }

  if (parsed.data.rfc !== undefined) {
    if (cliente.rfc && cliente.rfc.trim() !== "") {
      return NextResponse.json(
        { error: "RFC ya tiene un valor y no se puede sobrescribir" },
        { status: 400 }
      );
    }
    updateData.rfc = parsed.data.rfc;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  // 5. Aplicar actualizacion
  const updated = await prisma.clientes.update({
    where: { id: clienteId },
    data: updateData,
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
  });

  return NextResponse.json(updated);
}
