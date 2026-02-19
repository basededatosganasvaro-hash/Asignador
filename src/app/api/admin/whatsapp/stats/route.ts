import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - hoy.getDay()); // Domingo
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  // Contadores generales por período
  const [mensajesHoy, mensajesSemana, mensajesMes] = await Promise.all([
    prisma.wa_mensajes.count({ where: { enviado_at: { gte: hoy } } }),
    prisma.wa_mensajes.count({ where: { enviado_at: { gte: inicioSemana } } }),
    prisma.wa_mensajes.count({ where: { enviado_at: { gte: inicioMes } } }),
  ]);

  // Por estado
  const porEstado = await prisma.wa_mensajes.groupBy({
    by: ["estado"],
    _count: { id: true },
    where: { created_at: { gte: inicioMes } },
  });

  // Por promotor (top 10)
  const porPromotor = await prisma.wa_campanas.groupBy({
    by: ["usuario_id"],
    _sum: { enviados: true, entregados: true, leidos: true, fallidos: true },
    orderBy: { _sum: { enviados: "desc" } },
    take: 10,
  });

  // Obtener nombres de promotores
  const userIds = porPromotor.map((p) => p.usuario_id);
  const usuarios = await prisma.usuarios.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nombre: true },
  });
  const userMap = new Map(usuarios.map((u) => [u.id, u.nombre]));

  const porPromotorConNombre = porPromotor.map((p) => ({
    usuario_id: p.usuario_id,
    nombre: userMap.get(p.usuario_id) || "Desconocido",
    enviados: p._sum.enviados || 0,
    entregados: p._sum.entregados || 0,
    leidos: p._sum.leidos || 0,
    fallidos: p._sum.fallidos || 0,
  }));

  // Sesiones activas
  const sesionesActivas = await prisma.wa_sesiones.count({
    where: { estado: "CONECTADO" },
  });

  // Campañas activas
  const campanasActivas = await prisma.wa_campanas.count({
    where: { estado: { in: ["EN_COLA", "ENVIANDO"] } },
  });

  return NextResponse.json({
    mensajes: { hoy: mensajesHoy, semana: mensajesSemana, mes: mensajesMes },
    porEstado: porEstado.map((e) => ({ estado: e.estado, count: e._count.id })),
    porPromotor: porPromotorConNombre,
    sesionesActivas,
    campanasActivas,
  });
}
