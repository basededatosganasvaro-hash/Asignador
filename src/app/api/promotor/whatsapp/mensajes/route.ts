import { NextRequest, NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { session, error } = await requirePromotor();
  if (error) return error;
  const userId = Number(session!.user.id);

  const { searchParams } = req.nextUrl;
  const estado = searchParams.get("estado") || undefined;
  const campanaId = searchParams.get("campana_id") ? Number(searchParams.get("campana_id")) : undefined;
  const desde = searchParams.get("desde") ? new Date(searchParams.get("desde")!) : undefined;
  const hasta = searchParams.get("hasta")
    ? new Date(new Date(searchParams.get("hasta")!).setHours(23, 59, 59, 999))
    : undefined;
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(200, Number(searchParams.get("limit") || 50));

  const campanaWhere: Record<string, unknown> = { usuario_id: userId };
  if (campanaId) campanaWhere.id = campanaId;

  const where: Record<string, unknown> = {
    campana: { is: campanaWhere },
  };
  if (estado) where.estado = estado;
  if (desde || hasta) {
    where.created_at = {
      ...(desde ? { gte: desde } : {}),
      ...(hasta ? { lte: hasta } : {}),
    };
  }

  const [total, mensajes] = await Promise.all([
    prisma.wa_mensajes.count({ where }),
    prisma.wa_mensajes.findMany({
      where,
      include: {
        campana: { select: { id: true, nombre: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const resultado = mensajes.map((m) => ({
    id: m.id,
    nombre_cliente: m.nombre_cliente,
    numero_destino: m.numero_destino,
    estado: m.estado,
    error_detalle: m.error_detalle,
    enviado_at: m.enviado_at,
    entregado_at: m.entregado_at,
    leido_at: m.leido_at,
    created_at: m.created_at,
    campana_id: m.campana.id,
    campana_nombre: m.campana.nombre,
  }));

  return NextResponse.json({ mensajes: resultado, total, page, limit });
}
