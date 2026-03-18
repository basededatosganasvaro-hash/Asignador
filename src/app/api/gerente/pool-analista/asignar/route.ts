import { NextResponse } from "next/server";
import { requireGerente } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const asignarPoolSchema = z.object({
  pool_ids: z.array(z.number().int().positive()).min(1, "Selecciona al menos un registro"),
  promotor_id: z.number().int().positive("Selecciona un promotor"),
});

export async function POST(req: Request) {
  const { session, error, scopeFilter } = await requireGerente();
  if (error) return error;

  const body = await req.json();
  const parsed = asignarPoolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { pool_ids, promotor_id } = parsed.data;
  const gerenteId = Number(session.user.id);

  // Resolver region_id del gerente (regional directo, sucursal via DB)
  let gerenteRegionId: number | null = null;
  if (scopeFilter?.field === "region_id") {
    gerenteRegionId = scopeFilter.value ?? null;
  } else {
    const gerente = await prisma.usuarios.findUnique({
      where: { id: gerenteId },
      select: { region_id: true },
    });
    gerenteRegionId = gerente?.region_id ?? null;
  }

  // Verificar que el promotor existe, está activo y pertenece a la región
  const promotor = await prisma.usuarios.findFirst({
    where: { id: promotor_id, rol: "promotor", activo: true },
    select: { id: true, nombre: true, region_id: true },
  });
  if (!promotor) {
    return NextResponse.json({ error: "Promotor no encontrado o inactivo" }, { status: 400 });
  }
  if (gerenteRegionId && promotor.region_id !== gerenteRegionId) {
    return NextResponse.json({ error: "El promotor no pertenece a tu región" }, { status: 403 });
  }

  // Verificar que los pool_ids no estén ya asignados
  const poolItems = await prisma.pool_gerente.findMany({
    where: { id: { in: pool_ids }, asignado: false },
  });

  if (poolItems.length === 0) {
    return NextResponse.json({ error: "Los registros ya fueron asignados" }, { status: 400 });
  }

  // Validar que todos los items pertenecen a la región del gerente
  if (gerenteRegionId) {
    const fueraDeScope = poolItems.some((p) => p.region_id !== gerenteRegionId);
    if (fueraDeScope) {
      return NextResponse.json({ error: "Algunos registros están fuera de tu región" }, { status: 403 });
    }
  }

  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    // Marcar como asignados en pool
    await tx.pool_gerente.updateMany({
      where: { id: { in: poolItems.map((p) => p.id) } },
      data: {
        asignado: true,
        asignado_a: promotor_id,
        asignado_por: gerenteId,
        asignado_at: ahora,
      },
    });

    // Crear lote para el promotor
    const lote = await tx.lotes.create({
      data: {
        usuario_id: promotor_id,
        fecha: ahora,
        cantidad: poolItems.length,
      },
    });

    // Obtener etapa "Asignado"
    const etapaAsignado = await tx.embudo_etapas.findFirst({
      where: { nombre: "Asignado", activo: true },
    });

    // Crear oportunidades para cada cliente
    for (const item of poolItems) {
      await tx.oportunidades.create({
        data: {
          cliente_id: item.cliente_id,
          usuario_id: promotor_id,
          etapa_id: etapaAsignado?.id ?? null,
          origen: "POOL",
          lote_id: lote.id,
          activo: true,
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    asignados: poolItems.length,
    promotor: promotor.nombre,
  });
}
