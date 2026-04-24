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

    // Oportunidades con movimiento hoy, agrupadas por equipo, integrante y etapa actual
    prisma.$queryRaw<
      {
        equipo_id: number;
        equipo_nombre: string;
        usuario_id: number;
        usuario_nombre: string;
        etapa_id: number;
        total: bigint;
      }[]
    >`
      SELECT e.id AS equipo_id, e.nombre AS equipo_nombre,
             u.id AS usuario_id, u.nombre AS usuario_nombre,
             o.etapa_id, COUNT(DISTINCT o.id) AS total
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
      GROUP BY e.id, e.nombre, u.id, u.nombre, o.etapa_id
    `,
  ]);

  type Integrante = { id: number; nombre: string; total: number; etapas: Record<number, number> };
  type Equipo = { id: number; nombre: string; total: number; etapas: Record<number, number>; integrantes: Integrante[] };

  const porEquipoMap = new Map<number, Equipo>();
  const integrantesMap = new Map<string, Integrante>();

  for (const row of porEquipoRaw) {
    const n = Number(row.total);
    const equipo = porEquipoMap.get(row.equipo_id) ?? {
      id: row.equipo_id,
      nombre: row.equipo_nombre,
      total: 0,
      etapas: {},
      integrantes: [],
    };
    equipo.etapas[row.etapa_id] = (equipo.etapas[row.etapa_id] ?? 0) + n;
    equipo.total += n;
    porEquipoMap.set(row.equipo_id, equipo);

    const key = `${row.equipo_id}:${row.usuario_id}`;
    let integrante = integrantesMap.get(key);
    if (!integrante) {
      integrante = { id: row.usuario_id, nombre: row.usuario_nombre, total: 0, etapas: {} };
      integrantesMap.set(key, integrante);
      equipo.integrantes.push(integrante);
    }
    integrante.etapas[row.etapa_id] = (integrante.etapas[row.etapa_id] ?? 0) + n;
    integrante.total += n;
  }

  for (const eq of porEquipoMap.values()) {
    eq.integrantes.sort((a, b) => b.total - a.total);
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
