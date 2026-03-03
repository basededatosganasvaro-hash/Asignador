import { NextResponse } from "next/server";
import { requirePromotor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { session, error } = await requirePromotor();
  if (error) return error;
  const userId = Number(session!.user.id);

  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - hoy.getDay());
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  const campanaFilter = { campana: { is: { usuario_id: userId } } };

  const [mensajesHoy, mensajesSemana, mensajesMes] = await Promise.all([
    prisma.wa_mensajes.count({ where: { enviado_at: { gte: hoy }, ...campanaFilter } }),
    prisma.wa_mensajes.count({ where: { enviado_at: { gte: inicioSemana }, ...campanaFilter } }),
    prisma.wa_mensajes.count({ where: { enviado_at: { gte: inicioMes }, ...campanaFilter } }),
  ]);

  const porEstado = await prisma.wa_mensajes.groupBy({
    by: ["estado"],
    _count: { id: true },
    where: { created_at: { gte: inicioMes }, ...campanaFilter },
  });

  const campanasActivas = await prisma.wa_campanas.count({
    where: { usuario_id: userId, estado: { in: ["EN_COLA", "ENVIANDO"] } },
  });

  const campanas = await prisma.wa_campanas.findMany({
    where: { usuario_id: userId },
    select: {
      id: true,
      nombre: true,
      estado: true,
      total_mensajes: true,
      enviados: true,
      entregados: true,
      leidos: true,
      fallidos: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
    take: 20,
  });

  return NextResponse.json({
    mensajes: { hoy: mensajesHoy, semana: mensajesSemana, mes: mensajesMes },
    porEstado: porEstado.map((e) => ({ estado: e.estado, count: e._count.id })),
    campanasActivas,
    campanas,
  });
}
