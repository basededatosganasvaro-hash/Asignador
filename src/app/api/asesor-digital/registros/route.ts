import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAsesorDigital } from "@/lib/auth-utils";

const ETAPAS_VALIDAS = ["Leads", "Cotizacion", "No sujeto a credito", "Ventas"];
const STATUS_VALIDOS = ["Venta", "Interesado", "Cotizacion", "No viable", "Proceso", "Sin informacion"];

export async function GET() {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  const registros = await prisma.ad_registros.findMany({
    where: { usuario_id: Number(session.user.id), activo: true },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(registros);
}

export async function POST(request: Request) {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (!body.nombre_cliente?.trim()) {
    return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
  }

  if (!ETAPAS_VALIDAS.includes(body.etapa)) {
    return NextResponse.json({ error: "Etapa invalida" }, { status: 400 });
  }

  if (!STATUS_VALIDOS.includes(body.status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }

  const registro = await prisma.ad_registros.create({
    data: {
      usuario_id: Number(session.user.id),
      etapa: body.etapa,
      nombre_cliente: body.nombre_cliente.trim(),
      fecha: body.fecha ? new Date(body.fecha) : new Date(),
      status: body.status,
      estrategia: body.estrategia || null,
      flujo: body.flujo || null,
      numero_telefono: body.numero_telefono || null,
      curp: body.curp || null,
      nss: body.nss || null,
      rfc: body.rfc || null,
      zona: body.zona || null,
      campana: body.campana || null,
      capacidad: body.capacidad || null,
      monto_credito: body.monto_credito ?? null,
      tipo_credito: body.tipo_credito || null,
      convenio: body.convenio || null,
      etiqueta: body.etiqueta || null,
      oferta: body.oferta || null,
      motivo: body.motivo || null,
      id_venta: body.id_venta || null,
      viabilidad: body.viabilidad || null,
    },
  });

  return NextResponse.json(registro, { status: 201 });
}
