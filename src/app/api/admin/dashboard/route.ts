import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireGestion } from "@/lib/auth-utils";

export async function GET() {
  const { error } = await requireGestion();
  if (error) return error;

  // Bounds del día en America/Mexico_City (offset fijo -06:00, sin DST)
  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const y = nowMx.getFullYear();
  const m = String(nowMx.getMonth() + 1).padStart(2, "0");
  const d = String(nowMx.getDate()).padStart(2, "0");
  const startMx = new Date(`${y}-${m}-${d}T00:00:00-06:00`);
  const endMx = new Date(startMx.getTime() + 24 * 60 * 60 * 1000);

  const [
    totalClientes,
    clientesAsignados,
    totalPromotores,
    lotesHoy,
    etapas,
    porEquipoRaw,
  ] = await Promise.all([
    prismaClientes.clientes.count(),
    prisma.oportunidades.count({ where: { activo: true } }),
    prisma.usuarios.count({ where: { rol: "promotor", activo: true } }),
    prisma.lotes.count({ where: { fecha: { gte: startMx, lt: endMx } } }),

    prisma.embudo_etapas.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, orden: true, color: true },
    }),

    // Oportunidades con movimiento hoy, agrupadas por equipo y etapa actual
    prisma.$queryRaw<
      { equipo_id: number; equipo_nombre: string; etapa_id: number; total: bigint }[]
    >`
      SELECT e.id AS equipo_id, e.nombre AS equipo_nombre, o.etapa_id, COUNT(DISTINCT o.id) AS total
      FROM oportunidades o
      JOIN usuarios u ON u.id = o.usuario_id
      JOIN equipos e ON e.id = u.equipo_id
      WHERE o.activo = true
        AND o.etapa_id IS NOT NULL
        AND e.activo = true
        AND EXISTS (
          SELECT 1 FROM historial h
          WHERE h.oportunidad_id = o.id
            AND h.created_at >= ${startMx}
            AND h.created_at < ${endMx}
        )
      GROUP BY e.id, e.nombre, o.etapa_id
    `,
  ]);

  const porEquipoMap = new Map<number, { id: number; nombre: string; total: number; etapas: Record<number, number> }>();
  for (const row of porEquipoRaw) {
    const n = Number(row.total);
    const current = porEquipoMap.get(row.equipo_id) ?? {
      id: row.equipo_id,
      nombre: row.equipo_nombre,
      total: 0,
      etapas: {},
    };
    current.etapas[row.etapa_id] = (current.etapas[row.etapa_id] ?? 0) + n;
    current.total += n;
    porEquipoMap.set(row.equipo_id, current);
  }
  const porEquipo = Array.from(porEquipoMap.values()).sort((a, b) => b.total - a.total);

  return NextResponse.json({
    totalClientes,
    clientesAsignados,
    clientesDisponibles: Math.max(0, totalClientes - clientesAsignados),
    totalPromotores,
    lotesHoy,
    etapas,
    porEquipo,
  });
}
