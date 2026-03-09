import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAsesorDigital } from "@/lib/auth-utils";

const STATUS_VALIDOS = [
  "Venta", "Interesado", "No interesado", "Cotizacion", "No localizado",
  "Sin capacidad", "En proceso", "Sin informacion", "No apto", "Analisis", "Declinó",
];
const ESTRATEGIAS_VALIDAS = ["Facebook", "Wasapi", "Vox implant", "Organico", "Consunomina"];
const VIABILIDAD_VALIDA = ["Viable", "No viable"];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.ad_redes_sociales.findFirst({
    where: { id: Number(id), usuario_id: Number(session.user.id), activo: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (body.estrategia && !ESTRATEGIAS_VALIDAS.includes(body.estrategia)) {
    return NextResponse.json({ error: "Estrategia invalida" }, { status: 400 });
  }
  if (body.status && !STATUS_VALIDOS.includes(body.status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }
  if (body.viabilidad && body.viabilidad !== "" && !VIABILIDAD_VALIDA.includes(body.viabilidad)) {
    return NextResponse.json({ error: "Viabilidad invalida" }, { status: 400 });
  }

  const registro = await prisma.ad_redes_sociales.update({
    where: { id: Number(id) },
    data: {
      ...(body.nombre_cliente !== undefined && { nombre_cliente: String(body.nombre_cliente).trim() || existing.nombre_cliente }),
      ...(body.fecha !== undefined && { fecha: new Date(body.fecha) }),
      ...(body.estrategia !== undefined && { estrategia: body.estrategia }),
      ...(body.numero_telefono !== undefined && { numero_telefono: body.numero_telefono || null }),
      ...(body.curp !== undefined && { curp: body.curp || null }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.viabilidad !== undefined && { viabilidad: body.viabilidad || null }),
      ...(body.motivo !== undefined && { motivo: body.motivo || null }),
    },
  });

  return NextResponse.json(registro);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.ad_redes_sociales.findFirst({
    where: { id: Number(id), usuario_id: Number(session.user.id), activo: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  await prisma.ad_redes_sociales.update({
    where: { id: Number(id) },
    data: { activo: false },
  });

  return NextResponse.json({ ok: true });
}
