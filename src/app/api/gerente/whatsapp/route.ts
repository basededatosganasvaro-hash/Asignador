import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGerente } from "@/lib/auth-utils";

export async function GET() {
  const { error, scopeFilter } = await requireGerente();
  if (error) return error;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const hace4semanas = new Date(today);
  hace4semanas.setDate(today.getDate() - 28);

  const promotorIds = (await prisma.usuarios.findMany({
    where: { rol: "promotor", activo: true, [scopeFilter!.field]: scopeFilter!.value },
    select: { id: true },
  })).map((p) => p.id);

  if (promotorIds.length === 0) {
    return NextResponse.json({ kpis: { enviados: 0, entregados: 0, leidos: 0, fallidos: 0, tasaEntrega: 0, tasaLectura: 0 }, porPromotor: [], tendencia: [] });
  }

  const [totalesMes, porPromotor, tendencia] = await Promise.all([
    // KPIs del mes: por estado
    prisma.$queryRaw<{ estado: string; cantidad: bigint }[]>`
      SELECT m.estado, COUNT(*) as cantidad
      FROM wa_mensajes m
      JOIN wa_campanas c ON c.id = m.campana_id
      WHERE c.usuario_id = ANY(${promotorIds}::int[])
        AND m.created_at >= ${startOfMonth}
      GROUP BY m.estado
    `,

    // Por promotor
    prisma.$queryRaw<{ usuario_id: number; nombre: string; campanas: bigint; enviados: bigint; entregados: bigint; leidos: bigint; fallidos: bigint }[]>`
      SELECT c.usuario_id, u.nombre,
             COUNT(DISTINCT c.id) as campanas,
             SUM(c.enviados) as enviados,
             SUM(c.entregados) as entregados,
             SUM(c.leidos) as leidos,
             SUM(c.fallidos) as fallidos
      FROM wa_campanas c
      JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.usuario_id = ANY(${promotorIds}::int[])
        AND c.created_at >= ${startOfMonth}
      GROUP BY c.usuario_id, u.nombre
      ORDER BY enviados DESC
    `,

    // Tendencia semanal
    prisma.$queryRaw<{ semana: Date; enviados: bigint; entregados: bigint; leidos: bigint }[]>`
      SELECT date_trunc('week', m.created_at) as semana,
             COUNT(*) FILTER (WHERE m.estado IN ('ENVIADO','ENTREGADO','LEIDO')) as enviados,
             COUNT(*) FILTER (WHERE m.estado IN ('ENTREGADO','LEIDO')) as entregados,
             COUNT(*) FILTER (WHERE m.estado = 'LEIDO') as leidos
      FROM wa_mensajes m
      JOIN wa_campanas c ON c.id = m.campana_id
      WHERE c.usuario_id = ANY(${promotorIds}::int[])
        AND m.created_at >= ${hace4semanas}
      GROUP BY date_trunc('week', m.created_at)
      ORDER BY semana ASC
    `,
  ]);

  // Parsear KPIs
  const estadoMap = new Map(totalesMes.map((t) => [t.estado, Number(t.cantidad)]));
  const enviados = (estadoMap.get("ENVIADO") ?? 0) + (estadoMap.get("ENTREGADO") ?? 0) + (estadoMap.get("LEIDO") ?? 0);
  const entregados = (estadoMap.get("ENTREGADO") ?? 0) + (estadoMap.get("LEIDO") ?? 0);
  const leidos = estadoMap.get("LEIDO") ?? 0;
  const fallidos = estadoMap.get("FALLIDO") ?? 0;

  return NextResponse.json({
    kpis: {
      enviados,
      entregados,
      leidos,
      fallidos,
      tasaEntrega: enviados > 0 ? Math.round((entregados / enviados) * 10000) / 100 : 0,
      tasaLectura: enviados > 0 ? Math.round((leidos / enviados) * 10000) / 100 : 0,
    },
    porPromotor: porPromotor.map((p) => ({
      id: p.usuario_id,
      nombre: p.nombre,
      campanas: Number(p.campanas),
      enviados: Number(p.enviados),
      entregados: Number(p.entregados),
      leidos: Number(p.leidos),
      fallidos: Number(p.fallidos),
      tasaLectura: Number(p.enviados) > 0 ? Math.round((Number(p.leidos) / Number(p.enviados)) * 10000) / 100 : 0,
    })),
    tendencia: tendencia.map((t) => ({
      semana: t.semana,
      enviados: Number(t.enviados),
      entregados: Number(t.entregados),
      leidos: Number(t.leidos),
    })),
  });
}
