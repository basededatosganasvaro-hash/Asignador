import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAsesorDigital } from "@/lib/auth-utils";

const ETAPAS_VALIDAS = ["Leads", "Cotizacion", "No sujeto a credito", "Ventas"];
const STATUS_VALIDOS = ["Venta", "Interesado", "Cotizacion", "No viable", "Proceso", "Sin informacion"];

const FIELD_MAX_LEN: Record<string, number> = {
  nombre_cliente: 300, etapa: 30, status: 30, estrategia: 30, flujo: 20,
  numero_telefono: 20, curp: 18, nss: 15, rfc: 13, zona: 100, campana: 30,
  capacidad: 100, tipo_credito: 30, convenio: 100, etiqueta: 20, oferta: 5,
  id_venta: 100, viabilidad: 100,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function truncateStr(val: any, field: string): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val);
  if (!s) return null;
  const max = FIELD_MAX_LEN[field];
  return max && s.length > max ? s.slice(0, max) : s;
}

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

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
      ...(body.nombre_cliente !== undefined && { nombre_cliente: truncateStr(String(body.nombre_cliente).trim(), "nombre_cliente") || existing.nombre_cliente }),
      ...(body.fecha !== undefined && { fecha: isNaN(new Date(body.fecha).getTime()) ? existing.fecha : new Date(body.fecha) }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.estrategia !== undefined && { estrategia: truncateStr(body.estrategia, "estrategia") }),
      ...(body.flujo !== undefined && { flujo: truncateStr(body.flujo, "flujo") }),
      ...(body.numero_telefono !== undefined && { numero_telefono: truncateStr(body.numero_telefono, "numero_telefono") }),
      ...(body.curp !== undefined && { curp: truncateStr(body.curp, "curp") }),
      ...(body.nss !== undefined && { nss: truncateStr(body.nss, "nss") }),
      ...(body.rfc !== undefined && { rfc: truncateStr(body.rfc, "rfc") }),
      ...(body.zona !== undefined && { zona: truncateStr(body.zona, "zona") }),
      ...(body.campana !== undefined && { campana: truncateStr(body.campana, "campana") }),
      ...(body.capacidad !== undefined && { capacidad: truncateStr(body.capacidad, "capacidad") }),
      ...(body.monto_credito !== undefined && { monto_credito: body.monto_credito }),
      ...(body.tipo_credito !== undefined && { tipo_credito: truncateStr(body.tipo_credito, "tipo_credito") }),
      ...(body.convenio !== undefined && { convenio: truncateStr(body.convenio, "convenio") }),
      ...(body.etiqueta !== undefined && { etiqueta: truncateStr(body.etiqueta, "etiqueta") }),
      ...(body.oferta !== undefined && { oferta: truncateStr(body.oferta, "oferta") }),
      ...(body.motivo !== undefined && { motivo: typeof body.motivo === "string" ? body.motivo.slice(0, 1000) : null }),
      ...(body.id_venta !== undefined && { id_venta: truncateStr(body.id_venta, "id_venta") }),
      ...(body.viabilidad !== undefined && { viabilidad: truncateStr(body.viabilidad, "viabilidad") }),
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
