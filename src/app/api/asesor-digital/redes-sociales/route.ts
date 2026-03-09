import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAsesorDigital } from "@/lib/auth-utils";

const ESTRATEGIAS_VALIDAS = ["Facebook", "Wasapi", "Vox implant", "Organico", "Consunomina"];
const STATUS_VALIDOS = [
  "Venta", "Interesado", "No interesado", "Cotizacion", "No localizado",
  "Sin capacidad", "En proceso", "Sin informacion", "No apto", "Analisis", "Declinó",
];
const VIABILIDAD_VALIDA = ["Viable", "No viable"];

export async function GET(request: NextRequest) {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  const periodo = request.nextUrl.searchParams.get("periodo");

  let fechaFilter: { gte?: Date; lt?: Date } | undefined;
  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
    const [year, month] = periodo.split("-").map(Number);
    fechaFilter = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }

  const registros = await prisma.ad_redes_sociales.findMany({
    where: {
      usuario_id: Number(session.user.id),
      activo: true,
      ...(fechaFilter && { fecha: fechaFilter }),
    },
    select: {
      id: true, nombre_cliente: true, fecha: true, estrategia: true,
      numero_telefono: true, curp: true, status: true, viabilidad: true,
      motivo: true, created_at: true,
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

  if (!ESTRATEGIAS_VALIDAS.includes(body.estrategia)) {
    return NextResponse.json({ error: "Estrategia invalida" }, { status: 400 });
  }

  if (!STATUS_VALIDOS.includes(body.status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }

  if (body.viabilidad && !VIABILIDAD_VALIDA.includes(body.viabilidad)) {
    return NextResponse.json({ error: "Viabilidad invalida" }, { status: 400 });
  }

  const registro = await prisma.ad_redes_sociales.create({
    data: {
      usuario_id: Number(session.user.id),
      nombre_cliente: body.nombre_cliente.trim(),
      fecha: body.fecha ? new Date(body.fecha) : new Date(),
      estrategia: body.estrategia,
      numero_telefono: body.numero_telefono || null,
      curp: body.curp || null,
      status: body.status,
      viabilidad: body.viabilidad || null,
      motivo: body.motivo || null,
    },
  });

  return NextResponse.json(registro, { status: 201 });
}
