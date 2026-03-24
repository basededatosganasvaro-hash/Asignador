import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";

const REGISTROS_POR_ANALISTA = 300;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analistas = await prisma.usuarios.findMany({
    where: { rol: "analista", activo: true },
    select: { id: true, nombre: true, region_id: true },
  });

  if (analistas.length === 0) {
    return NextResponse.json({ message: "No hay analistas activos", asignados: 0 });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const lotesHoy = await prisma.lotes_analista.findMany({
    where: { fecha: hoy },
    select: { analista_id: true },
  });
  const analistasConLote = new Set(lotesHoy.map((l) => l.analista_id));
  const analistasSinLote = analistas.filter((a) => !analistasConLote.has(a.id));

  if (analistasSinLote.length === 0) {
    return NextResponse.json({ message: "Todos los analistas ya tienen lote hoy", asignados: 0 });
  }

  const idsExcluidosRaw = await prisma.$queryRaw<{ cliente_id: number }[]>`
    SELECT DISTINCT cliente_id FROM calificaciones_analista
    UNION
    SELECT DISTINCT cliente_id FROM pool_gerente
  `;
  const idsExcluidos = new Set(idsExcluidosRaw.map((r) => r.cliente_id));

  const totalNecesario = analistasSinLote.length * REGISTROS_POR_ANALISTA;
  const clientesIEPPO = await prismaClientes.clientes.findMany({
    where: {
      tipo_cliente: "Cartera para calificar IEPPO",
      id: { notIn: Array.from(idsExcluidos) },
    },
    select: { id: true },
    take: totalNecesario * 2,
  });

  // Si no hay IEPPO suficiente, buscar recalificaciones pendientes
  let recalificaciones: { id: number; cliente_id: number }[] = [];
  const hayIEPPOSuficiente = clientesIEPPO.length >= totalNecesario;

  if (!hayIEPPOSuficiente) {
    recalificaciones = await prisma.recalificaciones_pendientes.findMany({
      select: { id: true, cliente_id: true },
      take: totalNecesario - clientesIEPPO.length,
    });
  }

  // Combinar: primero IEPPO nuevos, luego recalificaciones (solo si IEPPO no alcanza)
  const todosClientes: { id: number; recalificar: boolean }[] = [
    ...clientesIEPPO.map((c) => ({ id: c.id, recalificar: false })),
    ...recalificaciones.map((r) => ({ id: r.cliente_id, recalificar: true })),
  ];

  if (todosClientes.length === 0) {
    return NextResponse.json({ message: "No hay clientes IEPPO ni recalificaciones disponibles", asignados: 0 });
  }

  // Fisher-Yates shuffle
  const shuffled = [...todosClientes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let totalAsignados = 0;
  let totalRecalificaciones = 0;
  const recalificacionIdsUsados: number[] = [];

  for (const analista of analistasSinLote) {
    const clientesParaAnalista = shuffled.splice(0, REGISTROS_POR_ANALISTA);
    if (clientesParaAnalista.length === 0) break;

    await prisma.$transaction(async (tx) => {
      const lote = await tx.lotes_analista.create({
        data: {
          analista_id: analista.id,
          fecha: hoy,
          cantidad: clientesParaAnalista.length,
          estado: "PENDIENTE",
        },
      });

      await tx.calificaciones_analista.createMany({
        data: clientesParaAnalista.map((c) => ({
          lote_id: lote.id,
          analista_id: analista.id,
          cliente_id: c.id,
          recalificar: c.recalificar,
        })),
      });
    });

    const recals = clientesParaAnalista.filter((c) => c.recalificar);
    totalRecalificaciones += recals.length;
    for (const r of recals) {
      const match = recalificaciones.find((rc) => rc.cliente_id === r.id);
      if (match) recalificacionIdsUsados.push(match.id);
    }

    totalAsignados += clientesParaAnalista.length;
  }

  // Eliminar recalificaciones pendientes ya asignadas
  if (recalificacionIdsUsados.length > 0) {
    await prisma.recalificaciones_pendientes.deleteMany({
      where: { id: { in: recalificacionIdsUsados } },
    });
  }

  return NextResponse.json({
    analistas_procesados: analistasSinLote.length,
    total_asignados: totalAsignados,
    total_recalificaciones: totalRecalificaciones,
    registros_por_analista: REGISTROS_POR_ANALISTA,
  });
}
