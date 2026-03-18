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

  // Obtener analistas activos
  const analistas = await prisma.usuarios.findMany({
    where: { rol: "analista", activo: true },
    select: { id: true, nombre: true, region_id: true },
  });

  if (analistas.length === 0) {
    return NextResponse.json({ message: "No hay analistas activos", asignados: 0 });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Verificar que no tengan lote de hoy
  const lotesHoy = await prisma.lotes_analista.findMany({
    where: { fecha: hoy },
    select: { analista_id: true },
  });
  const analistasConLote = new Set(lotesHoy.map((l) => l.analista_id));
  const analistasSinLote = analistas.filter((a) => !analistasConLote.has(a.id));

  if (analistasSinLote.length === 0) {
    return NextResponse.json({ message: "Todos los analistas ya tienen lote hoy", asignados: 0 });
  }

  // Obtener cliente_ids ya calificados o en proceso (para excluir)
  const calificacionesExistentes = await prisma.calificaciones_analista.findMany({
    select: { cliente_id: true },
  });
  const idsExcluidos = new Set(calificacionesExistentes.map((c) => c.cliente_id));

  // También excluir los que ya están en pool_gerente
  const poolExistentes = await prisma.pool_gerente.findMany({
    select: { cliente_id: true },
  });
  poolExistentes.forEach((p) => idsExcluidos.add(p.cliente_id));

  // Obtener cartera IEPPO de BD Clientes
  const totalNecesario = analistasSinLote.length * REGISTROS_POR_ANALISTA;
  const clientesIEPPO = await prismaClientes.clientes.findMany({
    where: {
      tipo_cliente: "Cartera para calificar IEPPO",
      id: { notIn: Array.from(idsExcluidos) },
    },
    select: { id: true },
    take: totalNecesario * 2, // margen extra para aleatorizar
  });

  if (clientesIEPPO.length === 0) {
    return NextResponse.json({ message: "No hay clientes IEPPO disponibles", asignados: 0 });
  }

  // Aleatorizar con Fisher-Yates
  const shuffled = [...clientesIEPPO];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let totalAsignados = 0;

  for (const analista of analistasSinLote) {
    const clientesParaAnalista = shuffled.splice(0, REGISTROS_POR_ANALISTA);
    if (clientesParaAnalista.length === 0) break;

    await prisma.$transaction(async (tx) => {
      // Crear lote
      const lote = await tx.lotes_analista.create({
        data: {
          analista_id: analista.id,
          fecha: hoy,
          cantidad: clientesParaAnalista.length,
          estado: "PENDIENTE",
        },
      });

      // Crear calificaciones individuales
      await tx.calificaciones_analista.createMany({
        data: clientesParaAnalista.map((c) => ({
          lote_id: lote.id,
          analista_id: analista.id,
          cliente_id: c.id,
        })),
      });
    });

    totalAsignados += clientesParaAnalista.length;
  }

  return NextResponse.json({
    analistas_procesados: analistasSinLote.length,
    total_asignados: totalAsignados,
    registros_por_analista: REGISTROS_POR_ANALISTA,
  });
}
