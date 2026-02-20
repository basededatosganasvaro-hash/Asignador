import { NextRequest, NextResponse } from "next/server";
import { requireGestion } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requireGestion();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const promotorId = searchParams.get("promotor_id") ? Number(searchParams.get("promotor_id")) : undefined;
  const equipoId = searchParams.get("equipo_id") ? Number(searchParams.get("equipo_id")) : undefined;
  const estado = searchParams.get("estado") || undefined;
  const desde = searchParams.get("desde") ? new Date(searchParams.get("desde")!) : undefined;
  const hasta = searchParams.get("hasta")
    ? new Date(new Date(searchParams.get("hasta")!).setHours(23, 59, 59, 999))
    : undefined;
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(200, Number(searchParams.get("limit") || 50));

  // Filtros sobre wa_mensajes
  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (desde || hasta) {
    where.created_at = {
      ...(desde ? { gte: desde } : {}),
      ...(hasta ? { lte: hasta } : {}),
    };
  }

  // Filtros sobre la campaña (promotor / equipo)
  const campanaWhere: Record<string, unknown> = {};
  if (promotorId) campanaWhere.usuario_id = promotorId;
  if (equipoId) campanaWhere.usuario = { equipo_id: equipoId };
  if (Object.keys(campanaWhere).length > 0) where.campana = campanaWhere;

  const [total, mensajes, promotores, equipos] = await Promise.all([
    prisma.wa_mensajes.count({ where }),
    prisma.wa_mensajes.findMany({
      where,
      include: {
        campana: {
          select: {
            id: true,
            nombre: true,
            usuario: {
              select: {
                id: true,
                nombre: true,
                equipo: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    // Lista de promotores que han enviado campañas (para el filtro)
    prisma.usuarios.findMany({
      where: {
        rol: "promotor",
        wa_campanas: { some: {} },
      },
      select: { id: true, nombre: true, equipo_id: true },
      orderBy: { nombre: "asc" },
    }),
    // Lista de equipos con al menos un promotor con campañas
    prisma.equipos.findMany({
      where: {
        miembros: { some: { rol: "promotor", wa_campanas: { some: {} } } },
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
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
    promotor_id: m.campana.usuario.id,
    promotor_nombre: m.campana.usuario.nombre,
    equipo_id: m.campana.usuario.equipo?.id ?? null,
    equipo_nombre: m.campana.usuario.equipo?.nombre ?? null,
  }));

  return NextResponse.json({ mensajes: resultado, total, page, limit, promotores, equipos });
}
