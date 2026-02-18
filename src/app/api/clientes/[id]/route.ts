import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
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

  // 1. Verificar que el cliente tiene oportunidad activa asignada a este usuario (BD Sistema)
  const oportunidad = await prisma.oportunidades.findFirst({
    where: { cliente_id: clienteId, usuario_id: userId, activo: true },
  });

  if (!oportunidad) {
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

  // 3. Obtener datos originales del cliente (BD Clientes - SOLO LECTURA)
  const cliente = await prismaClientes.clientes.findUnique({
    where: { id: clienteId },
    select: { id: true, curp: true, rfc: true, nombres: true, tel_1: true,
              tel_2: true, tel_3: true, tel_4: true, tel_5: true,
              num_empleado: true, estado: true, municipio: true, convenio: true, oferta: true },
  });

  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  // 4. Obtener ediciones existentes en BD Sistema
  const edicionesExistentes = await prisma.datos_contacto.findMany({
    where: { cliente_id: clienteId },
    orderBy: { created_at: "asc" },
  });
  const edicionesActuales = new Map(edicionesExistentes.map((e) => [e.campo, e.valor]));

  // 5. Validar campos condicionales y construir nuevas ediciones
  const nuevasEdiciones: { campo: string; valor: string }[] = [];

  if (parsed.data.tel_1 !== undefined) {
    nuevasEdiciones.push({ campo: "tel_1", valor: parsed.data.tel_1 });
  }

  if (parsed.data.num_empleado !== undefined) {
    nuevasEdiciones.push({ campo: "num_empleado", valor: parsed.data.num_empleado });
  }

  if (parsed.data.curp !== undefined) {
    // Inmutable si ya tiene valor (original o editado)
    const curpActual = edicionesActuales.get("curp") ?? cliente.curp;
    if (curpActual && curpActual.trim() !== "") {
      return NextResponse.json(
        { error: "CURP ya tiene un valor y no se puede sobrescribir" },
        { status: 400 }
      );
    }
    nuevasEdiciones.push({ campo: "curp", valor: parsed.data.curp });
  }

  if (parsed.data.rfc !== undefined) {
    // Inmutable si ya tiene valor (original o editado)
    const rfcActual = edicionesActuales.get("rfc") ?? cliente.rfc;
    if (rfcActual && rfcActual.trim() !== "") {
      return NextResponse.json(
        { error: "RFC ya tiene un valor y no se puede sobrescribir" },
        { status: 400 }
      );
    }
    nuevasEdiciones.push({ campo: "rfc", valor: parsed.data.rfc });
  }

  if (nuevasEdiciones.length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  // 6. Guardar ediciones en BD Sistema (nunca toca BD Clientes)
  await prisma.datos_contacto.createMany({
    data: nuevasEdiciones.map((e) => ({
      cliente_id: clienteId,
      campo: e.campo,
      valor: e.valor,
      editado_por: userId,
    })),
  });

  // 7. Devolver datos mergeados (original + todas las ediciones)
  const todasEdiciones = new Map(edicionesActuales);
  for (const e of nuevasEdiciones) {
    todasEdiciones.set(e.campo, e.valor);
  }

  return NextResponse.json({
    id: cliente.id,
    nombres: cliente.nombres,
    tel_1: todasEdiciones.get("tel_1") ?? cliente.tel_1,
    tel_2: cliente.tel_2,
    tel_3: cliente.tel_3,
    tel_4: cliente.tel_4,
    tel_5: cliente.tel_5,
    curp: todasEdiciones.get("curp") ?? cliente.curp,
    rfc: todasEdiciones.get("rfc") ?? cliente.rfc,
    num_empleado: todasEdiciones.get("num_empleado") ?? cliente.num_empleado,
    estado: cliente.estado,
    municipio: cliente.municipio,
    convenio: cliente.convenio,
    oferta: cliente.oferta,
  });
}
