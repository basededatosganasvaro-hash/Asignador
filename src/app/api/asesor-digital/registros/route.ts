import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAsesorDigital } from "@/lib/auth-utils";

const ETAPAS_VALIDAS = ["Leads", "Cotizacion", "No sujeto a credito", "Ventas"];
const STATUS_VALIDOS = ["Venta", "Interesado", "Cotizacion", "No viable", "Proceso", "Sin informacion"];

export async function GET(request: NextRequest) {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  const periodo = request.nextUrl.searchParams.get("periodo"); // "YYYY-MM"

  // Filtro de fecha por periodo (server-side)
  let fechaFilter: { gte?: Date; lt?: Date } | undefined;
  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
    const [year, month] = periodo.split("-").map(Number);
    fechaFilter = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }

  const registros = await prisma.ad_registros.findMany({
    where: {
      usuario_id: Number(session.user.id),
      activo: true,
      ...(fechaFilter && { fecha: fechaFilter }),
    },
    select: {
      id: true, etapa: true, nombre_cliente: true, fecha: true, status: true,
      estrategia: true, flujo: true, numero_telefono: true, curp: true,
      nss: true, rfc: true, zona: true, campana: true, capacidad: true,
      monto_credito: true, tipo_credito: true, convenio: true, etiqueta: true,
      oferta: true, motivo: true, id_venta: true, viabilidad: true,
      created_at: true,
    },
    orderBy: { fecha: "desc" },
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
