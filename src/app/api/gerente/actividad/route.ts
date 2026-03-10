import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGerente } from "@/lib/auth-utils";

export async function GET() {
  const { error, scopeFilter } = await requireGerente();
  if (error) return error;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hace7dias = new Date(today);
  hace7dias.setDate(today.getDate() - 7);

  const promotores = await prisma.usuarios.findMany({
    where: { rol: "promotor", activo: true, [scopeFilter!.field]: scopeFilter!.value },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  const promotorIds = promotores.map((p) => p.id);

  if (promotorIds.length === 0) {
    return NextResponse.json({ hoy: [], semanal: [] });
  }

  const [actividadHoy, ultimaInteraccion, asignacionesHoy, actividadSemanal] = await Promise.all([
    // Actividad de hoy por promotor y tipo
    prisma.$queryRaw<{ usuario_id: number; tipo: string; cantidad: bigint }[]>`
      SELECT usuario_id, tipo, COUNT(*) as cantidad
      FROM historial
      WHERE usuario_id = ANY(${promotorIds}::int[])
        AND created_at >= ${today}
        AND tipo IN ('CAMBIO_ETAPA', 'NOTA', 'LLAMADA', 'WHATSAPP', 'SMS')
      GROUP BY usuario_id, tipo
    `,

    // Última interacción de cada promotor
    prisma.$queryRaw<{ usuario_id: number; ultima: Date }[]>`
      SELECT usuario_id, MAX(created_at) as ultima
      FROM historial
      WHERE usuario_id = ANY(${promotorIds}::int[])
        AND tipo IN ('CAMBIO_ETAPA', 'NOTA', 'LLAMADA', 'WHATSAPP', 'SMS')
      GROUP BY usuario_id
    `,

    // Asignaciones de hoy
    prisma.$queryRaw<{ usuario_id: number; cantidad: bigint }[]>`
      SELECT usuario_id, COALESCE(SUM(cantidad), 0) as cantidad
      FROM lotes
      WHERE usuario_id = ANY(${promotorIds}::int[])
        AND fecha >= ${today}
      GROUP BY usuario_id
    `,

    // Actividad semanal: por día y promotor
    prisma.$queryRaw<{ usuario_id: number; dia: Date; cantidad: bigint }[]>`
      SELECT usuario_id, date_trunc('day', created_at) as dia, COUNT(*) as cantidad
      FROM historial
      WHERE usuario_id = ANY(${promotorIds}::int[])
        AND created_at >= ${hace7dias}
        AND tipo IN ('CAMBIO_ETAPA', 'NOTA', 'LLAMADA', 'WHATSAPP', 'SMS')
      GROUP BY usuario_id, date_trunc('day', created_at)
      ORDER BY dia ASC
    `,
  ]);

  // Build maps
  const actHoyMap = new Map<number, Record<string, number>>();
  for (const a of actividadHoy) {
    if (!actHoyMap.has(a.usuario_id)) actHoyMap.set(a.usuario_id, {});
    actHoyMap.get(a.usuario_id)![a.tipo] = Number(a.cantidad);
  }

  const ultimaMap = new Map(ultimaInteraccion.map((u) => [u.usuario_id, u.ultima]));
  const asignMap = new Map(asignacionesHoy.map((a) => [a.usuario_id, Number(a.cantidad)]));

  const hoy = promotores.map((p) => {
    const actividad = actHoyMap.get(p.id) ?? {};
    const total = Object.values(actividad).reduce((s, v) => s + v, 0);
    const ultima = ultimaMap.get(p.id);
    const horasSinActividad = ultima
      ? Math.round((now.getTime() - new Date(ultima).getTime()) / 3600000 * 10) / 10
      : null;

    return {
      id: p.id,
      nombre: p.nombre,
      asignaciones: asignMap.get(p.id) ?? 0,
      transiciones: actividad["CAMBIO_ETAPA"] ?? 0,
      llamadas: actividad["LLAMADA"] ?? 0,
      whatsapp: actividad["WHATSAPP"] ?? 0,
      sms: actividad["SMS"] ?? 0,
      notas: actividad["NOTA"] ?? 0,
      total,
      horasSinActividad,
      sinActividad: total === 0,
    };
  });

  // Heatmap semanal: días × promotores
  const semanal = actividadSemanal.map((a) => ({
    usuario_id: a.usuario_id,
    dia: a.dia,
    cantidad: Number(a.cantidad),
  }));

  // Resumen por tipo en la semana
  const resumenSemanal = await prisma.$queryRaw<{ tipo: string; cantidad: bigint }[]>`
    SELECT tipo, COUNT(*) as cantidad
    FROM historial
    WHERE usuario_id = ANY(${promotorIds}::int[])
      AND created_at >= ${hace7dias}
      AND tipo IN ('CAMBIO_ETAPA', 'NOTA', 'LLAMADA', 'WHATSAPP', 'SMS')
    GROUP BY tipo
  `;

  return NextResponse.json({
    hoy,
    semanal,
    resumenSemanal: resumenSemanal.map((r) => ({ tipo: r.tipo, cantidad: Number(r.cantidad) })),
  });
}
