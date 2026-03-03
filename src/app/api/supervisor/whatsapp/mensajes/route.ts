import { NextRequest, NextResponse } from "next/server";
import { requireSupervisor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const supervisorId = parseInt(session.user.id);

  const supervisor = await prisma.usuarios.findUnique({
    where: { id: supervisorId },
    select: { equipo_id: true },
  });

  if (!supervisor?.equipo_id) {
    return NextResponse.json({ error: "No tienes equipo asignado" }, { status: 400 });
  }

  const equipoId = supervisor.equipo_id;

  const { searchParams } = req.nextUrl;
  const promotorId = searchParams.get("promotor_id") ? Number(searchParams.get("promotor_id")) : undefined;
  const estado = searchParams.get("estado") || undefined;
  const desde = searchParams.get("desde") ? new Date(searchParams.get("desde")!) : undefined;
  const hasta = searchParams.get("hasta")
    ? new Date(new Date(searchParams.get("hasta")!).setHours(23, 59, 59, 999))
    : undefined;
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(200, Number(searchParams.get("limit") || 50));

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (desde || hasta) {
    where.created_at = {
      ...(desde ? { gte: desde } : {}),
      ...(hasta ? { lte: hasta } : {}),
    };
  }

  // Always scope to team
  const campanaWhere: Record<string, unknown> = { usuario: { equipo_id: equipoId } };
  if (promotorId) campanaWhere.usuario_id = promotorId;
  where.campana = campanaWhere;

  const [total, mensajes, promotores] = await Promise.all([
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
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    // Only team promotores
    prisma.usuarios.findMany({
      where: {
        equipo_id: equipoId,
        rol: "promotor",
        wa_campanas: { some: {} },
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
  }));

  return NextResponse.json({ mensajes: resultado, total, page, limit, promotores });
}
