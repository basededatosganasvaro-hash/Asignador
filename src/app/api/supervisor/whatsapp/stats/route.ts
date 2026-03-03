import { NextResponse } from "next/server";
import { requireSupervisor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - hoy.getDay());
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  const equipoScope = { campana: { usuario: { equipo_id: equipoId } } };

  const [mensajesHoy, mensajesSemana, mensajesMes] = await Promise.all([
    prisma.wa_mensajes.count({ where: { enviado_at: { gte: hoy }, ...equipoScope } }),
    prisma.wa_mensajes.count({ where: { enviado_at: { gte: inicioSemana }, ...equipoScope } }),
    prisma.wa_mensajes.count({ where: { enviado_at: { gte: inicioMes }, ...equipoScope } }),
  ]);

  const porEstado = await prisma.wa_mensajes.groupBy({
    by: ["estado"],
    _count: { id: true },
    where: { created_at: { gte: inicioMes }, ...equipoScope },
  });

  const porPromotor = await prisma.wa_campanas.groupBy({
    by: ["usuario_id"],
    _sum: { enviados: true, entregados: true, leidos: true, fallidos: true },
    where: { usuario: { equipo_id: equipoId } },
    orderBy: { _sum: { enviados: "desc" } },
    take: 10,
  });

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

  const sesionesActivas = await prisma.wa_sesiones.count({
    where: { estado: "CONECTADO", usuario: { equipo_id: equipoId } },
  });

  const campanasActivas = await prisma.wa_campanas.count({
    where: { estado: { in: ["EN_COLA", "ENVIANDO"] }, usuario: { equipo_id: equipoId } },
  });

  return NextResponse.json({
    mensajes: { hoy: mensajesHoy, semana: mensajesSemana, mes: mensajesMes },
    porEstado: porEstado.map((e) => ({ estado: e.estado, count: e._count.id })),
    porPromotor: porPromotorConNombre,
    sesionesActivas,
    campanasActivas,
  });
}
