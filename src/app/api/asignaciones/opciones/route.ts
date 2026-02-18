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
  const tiene_telefono = searchParams.get("tiene_telefono") === "1";

  // IDs activos a excluir (para el conteo real)
  const activas = await prisma.oportunidades.findMany({
    where: { activo: true },
    select: { cliente_id: true },
  });
  const excludeIds = activas
    .map((o) => o.cliente_id)
    .filter((id): id is number => id !== null);

  // Base where para excluir activos (usada en todas las queries de opciones
  // para que muestren solo valores que realmente tienen registros disponibles)
  const baseExclude = excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {};

  // Cupo restante del día
  const config = await prisma.configuracion.findUnique({
    where: { clave: "max_registros_por_dia" },
  });
  const maxPerDay = parseInt(config?.valor || "300");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const lotesHoy = await prisma.lotes.findMany({
    where: { usuario_id: userId, fecha: { gte: today, lt: tomorrow } },
    select: { cantidad: true },
  });
  const cupoRestante = Math.max(0, maxPerDay - lotesHoy.reduce((s, l) => s + l.cantidad, 0));

  // Queries en paralelo — cada una filtra por los upstream ya seleccionados
  const [tiposRaw, conveniosRaw, estadosRaw, municipiosRaw, disponibles] = await Promise.all([
    // tipo_cliente: siempre independiente (muestra todos los que tienen stock)
    prismaClientes.clientes.findMany({
      select: { tipo_cliente: true },
      distinct: ["tipo_cliente"],
      where: { ...baseExclude },
      orderBy: { tipo_cliente: "asc" },
    }),

    // convenios: depende de tipo_cliente
    prismaClientes.clientes.findMany({
      select: { convenio: true },
      distinct: ["convenio"],
      where: {
        ...baseExclude,
        ...(tipo_cliente ? { tipo_cliente } : {}),
      },
      orderBy: { convenio: "asc" },
    }),

    // estados: depende de tipo_cliente + convenio
    prismaClientes.clientes.findMany({
      select: { estado: true },
      distinct: ["estado"],
      where: {
        ...baseExclude,
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
            ...baseExclude,
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
