import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/asignaciones/opciones
 * Devuelve opciones en cascada + conteo disponible en una sola llamada.
 * Cada selector solo muestra valores que existen dado el contexto actual.
 *
 * Cascada:
 *   tiposCliente → siempre independiente
 *   convenios    → filtrado por tipo_cliente seleccionado
 *   estados      → filtrado por tipo_cliente + convenio
 *   municipios   → filtrado por tipo_cliente + convenio + estado
 *   disponibles  → conteo con todos los filtros + excluye activos
 */
export async function GET(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = parseInt(session.user.id);
  const { searchParams } = new URL(req.url);

  const tipo_cliente  = searchParams.get("tipo_cliente")  || undefined;
  const convenio      = searchParams.get("convenio")      || undefined;
  const estado        = searchParams.get("estado")        || undefined;
  const municipio     = searchParams.get("municipio")     || undefined;
  const tiene_telefono = searchParams.get("tiene_telefono") === "true" || searchParams.get("tiene_telefono") === "1";

  // IDs activos a excluir (para el conteo real)
  const activas = await prisma.oportunidades.findMany({
    where: { activo: true },
    select: { cliente_id: true },
  });
  const excludeIds = new Set(
    activas.map((o) => o.cliente_id).filter((id): id is number => id !== null)
  );

  // Cooldown: excluir clientes que este promotor ya trabajó en los últimos N meses
  const cooldownConfig = await prisma.configuracion.findUnique({
    where: { clave: "cooldown_meses" },
  });
  const cooldownMeses = parseInt(cooldownConfig?.valor || "3");
  const cooldownDate = new Date();
  cooldownDate.setMonth(cooldownDate.getMonth() - cooldownMeses);

  const cooldownOps = await prisma.oportunidades.findMany({
    where: {
      usuario_id: userId,
      cliente_id: { not: null },
      created_at: { gte: cooldownDate },
    },
    select: { cliente_id: true },
  });
  for (const op of cooldownOps) {
    if (op.cliente_id !== null) excludeIds.add(op.cliente_id);
  }

  const excludeArray = Array.from(excludeIds);

  // Base where para excluir activos + cooldown
  const baseExclude = excludeArray.length > 0 ? { id: { notIn: excludeArray } } : {};

  // Cupo restante del día (timezone Mexico)
  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const config = await prisma.configuracion.findUnique({
    where: { clave: "max_registros_por_dia" },
  });
  const maxPerDay = parseInt(config?.valor || "300");

  // Intentar cupo_diario, fallback a lotes si la tabla no existe aún
  let cupoRestante: number;
  try {
    const cupo = await prisma.cupo_diario.findUnique({
      where: { usuario_id_fecha: { usuario_id: userId, fecha: today } },
    });
    cupoRestante = Math.max(0, maxPerDay - (cupo?.total_asignado ?? 0));
  } catch {
    const lotesHoy = await prisma.lotes.findMany({
      where: { usuario_id: userId, fecha: { gte: today, lt: tomorrow } },
      select: { cantidad: true },
    });
    cupoRestante = Math.max(0, maxPerDay - lotesHoy.reduce((s, l) => s + l.cantidad, 0));
  }

  // Queries en paralelo — cada una filtra por los upstream ya seleccionados
  // NOTA: las queries de distinct NO usan baseExclude (sería lento con NOT IN miles de IDs)
  // Solo el count final lo usa para dar el número real de disponibles
  const [tiposRaw, conveniosRaw, estadosRaw, municipiosRaw, disponibles] = await Promise.all([
    // tipo_cliente: siempre independiente
    prismaClientes.clientes.findMany({
      select: { tipo_cliente: true },
      distinct: ["tipo_cliente"],
      orderBy: { tipo_cliente: "asc" },
    }),

    // convenios: depende de tipo_cliente
    prismaClientes.clientes.findMany({
      select: { convenio: true },
      distinct: ["convenio"],
      where: {
        ...(tipo_cliente ? { tipo_cliente } : {}),
      },
      orderBy: { convenio: "asc" },
    }),

    // estados: depende de tipo_cliente + convenio
    prismaClientes.clientes.findMany({
      select: { estado: true },
      distinct: ["estado"],
      where: {
        ...(tipo_cliente ? { tipo_cliente } : {}),
        ...(convenio ? { convenio } : {}),
      },
      orderBy: { estado: "asc" },
    }),

    // municipios: depende de tipo_cliente + convenio + estado
    estado
      ? prismaClientes.clientes.findMany({
          select: { municipio: true },
          distinct: ["municipio"],
          where: {
            ...(tipo_cliente ? { tipo_cliente } : {}),
            ...(convenio ? { convenio } : {}),
            estado,
          },
          orderBy: { municipio: "asc" },
        })
      : Promise.resolve([]),

    // conteo disponible con todos los filtros activos
    prismaClientes.clientes.count({
      where: {
        ...baseExclude,
        ...(tipo_cliente ? { tipo_cliente } : {}),
        ...(convenio ? { convenio } : {}),
        ...(estado ? { estado } : {}),
        ...(municipio ? { municipio } : {}),
        ...(tiene_telefono ? { tel_1: { not: null } } : {}),
      },
    }),
  ]);

  return NextResponse.json({
    tiposCliente: tiposRaw.map((r) => r.tipo_cliente).filter(Boolean),
    convenios:    conveniosRaw.map((r) => r.convenio).filter(Boolean),
    estados:      estadosRaw.map((r) => r.estado).filter(Boolean),
    municipios:   municipiosRaw.map((r) => (r as { municipio?: string | null }).municipio).filter(Boolean),
    disponibles,
    cupoRestante,
    asignables: Math.min(disponibles, cupoRestante),
  });
}
