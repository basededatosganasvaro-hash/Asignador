import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAsesorDigital } from "@/lib/auth-utils";

const ETAPAS_VALIDAS = ["Leads", "Cotizacion", "No sujeto a credito", "Ventas"];
const STATUS_VALIDOS = ["Venta", "Interesado", "Cotizacion", "No viable", "Proceso", "Sin informacion"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  const { id } = await params;
  const registro = await prisma.ad_registros.findFirst({
    where: { id: Number(id), usuario_id: Number(session.user.id), activo: true },
  });

  if (!registro) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  return NextResponse.json(registro);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.ad_registros.findFirst({
    where: { id: Number(id), usuario_id: Number(session.user.id), activo: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  const body = await request.json();

  if (body.etapa && !ETAPAS_VALIDAS.includes(body.etapa)) {
    return NextResponse.json({ error: "Etapa invalida" }, { status: 400 });
  }

  if (body.status && !STATUS_VALIDOS.includes(body.status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }

  const registro = await prisma.ad_registros.update({
    where: { id: Number(id) },
    data: {
      ...(body.etapa !== undefined && { etapa: body.etapa }),
      ...(body.nombre_cliente !== undefined && { nombre_cliente: body.nombre_cliente.trim() }),
      ...(body.fecha !== undefined && { fecha: new Date(body.fecha) }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.estrategia !== undefined && { estrategia: body.estrategia }),
      ...(body.flujo !== undefined && { flujo: body.flujo }),
      ...(body.numero_telefono !== undefined && { numero_telefono: body.numero_telefono }),
      ...(body.curp !== undefined && { curp: body.curp }),
      ...(body.nss !== undefined && { nss: body.nss }),
      ...(body.rfc !== undefined && { rfc: body.rfc }),
      ...(body.zona !== undefined && { zona: body.zona }),
      ...(body.campana !== undefined && { campana: body.campana }),
      ...(body.capacidad !== undefined && { capacidad: body.capacidad }),
      ...(body.monto_credito !== undefined && { monto_credito: body.monto_credito }),
      ...(body.tipo_credito !== undefined && { tipo_credito: body.tipo_credito }),
      ...(body.convenio !== undefined && { convenio: body.convenio }),
      ...(body.etiqueta !== undefined && { etiqueta: body.etiqueta }),
      ...(body.oferta !== undefined && { oferta: body.oferta }),
      ...(body.motivo !== undefined && { motivo: body.motivo }),
      ...(body.id_venta !== undefined && { id_venta: body.id_venta }),
      ...(body.viabilidad !== undefined && { viabilidad: body.viabilidad }),
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
  const existing = await prisma.ad_registros.findFirst({
    where: { id: Number(id), usuario_id: Number(session.user.id), activo: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  await prisma.ad_registros.update({
    where: { id: Number(id) },
    data: { activo: false },
  });

  return NextResponse.json({ ok: true });
}
