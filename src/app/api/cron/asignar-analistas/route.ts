import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";

const REGISTROS_POR_ANALISTA = 100;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Advisory lock para evitar ejecución concurrente (C8)
  const lockAcquired = await prisma.$queryRaw<{ pg_try_advisory_lock: boolean }[]>`
    SELECT pg_try_advisory_lock(100001)
  `;
  if (!lockAcquired[0]?.pg_try_advisory_lock) {
    return NextResponse.json({ message: "CRON ya en ejecución", asignados: 0 });
  }

  try {
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

  // Obtener IDs excluidos de BD Sistema via raw SQL (una sola query, sin cargar en JS)
  const idsExcluidosRaw = await prisma.$queryRaw<{ cliente_id: number }[]>`
    SELECT DISTINCT cliente_id FROM calificaciones_analista
    UNION
    SELECT DISTINCT cliente_id FROM pool_gerente
  `;
  const idsExcluidos = idsExcluidosRaw.map((r) => r.cliente_id);

  const totalNecesario = analistasSinLote.length * REGISTROS_POR_ANALISTA;

  // Usar != ALL($1::int[]) en vez de NOT IN con parámetros individuales para evitar
  // exceder el límite de 65535 parámetros de PostgreSQL
  const clientesIEPPO = idsExcluidos.length > 0
    ? await prismaClientes.$queryRaw<{ id: number }[]>`
        SELECT id FROM clientes
        WHERE tipo_cliente = 'Cartera para calificar IEPPO'
          AND id != ALL(${idsExcluidos}::int[])
        ORDER BY RANDOM()
        LIMIT ${totalNecesario}
      `
    : await prismaClientes.$queryRaw<{ id: number }[]>`
        SELECT id FROM clientes
        WHERE tipo_cliente = 'Cartera para calificar IEPPO'
        ORDER BY RANDOM()
        LIMIT ${totalNecesario}
      `;

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
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(100001)`;
  }
}
