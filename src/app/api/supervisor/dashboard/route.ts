import { NextResponse } from "next/server";
import { requireSupervisor } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const supervisorId = parseInt(session.user.id);

  // Obtener equipo del supervisor
  const supervisor = await prisma.usuarios.findUnique({
    where: { id: supervisorId },
    select: { equipo_id: true },
  });

  if (!supervisor?.equipo_id) {
    return NextResponse.json({ error: "No tienes equipo asignado" }, { status: 400 });
  }

  const equipoId = supervisor.equipo_id;

  // Etapas activas de tipo AVANCE + especiales (para columnas)
  const etapas = await prisma.embudo_etapas.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
    select: { id: true, nombre: true, color: true, tipo: true },
  });

  // Promotores del equipo
  const promotores = await prisma.usuarios.findMany({
    where: { equipo_id: equipoId, rol: "promotor", activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const promotorIds = promotores.map((p) => p.id);

  // Counts por promotor + etapa
  const counts = await prisma.oportunidades.groupBy({
    by: ["usuario_id", "etapa_id"],
    where: {
      usuario_id: { in: promotorIds },
      activo: true,
    },
    _count: { id: true },
  });

  // Build map: promotorId -> { etapaId -> count }
  const countMap = new Map<number, Map<number, number>>();
  for (const c of counts) {
    if (!c.usuario_id || !c.etapa_id) continue;
    if (!countMap.has(c.usuario_id)) countMap.set(c.usuario_id, new Map());
    countMap.get(c.usuario_id)!.set(c.etapa_id, c._count.id);
  }

  const promotoresData = promotores.map((p) => {
    const etapaCounts = countMap.get(p.id) || new Map();
    const porEtapa: Record<number, number> = {};
    let total = 0;
    for (const [etapaId, count] of etapaCounts) {
      porEtapa[etapaId] = count;
      total += count;
    }
    return { id: p.id, nombre: p.nombre, porEtapa, total };
  });

  // Totales
  const totales: Record<number, number> = {};
  let totalGeneral = 0;
  for (const p of promotoresData) {
    for (const [etapaId, count] of Object.entries(p.porEtapa)) {
      totales[Number(etapaId)] = (totales[Number(etapaId)] || 0) + count;
    }
    totalGeneral += p.total;
  }

  return NextResponse.json({
    etapas,
    promotores: promotoresData,
    totales,
    totalGeneral,
    promotoresActivos: promotores.length,
  });
}
