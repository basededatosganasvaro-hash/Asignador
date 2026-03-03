import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireSupervisor } from "@/lib/auth-utils";
import { getConfig } from "@/lib/config-cache";

export async function GET(req: Request) {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const supervisorId = parseInt(session.user.id);

  const supervisor = await prisma.usuarios.findUnique({
    where: { id: supervisorId },
    select: { equipo_id: true },
  });

  if (!supervisor?.equipo_id) {
    return NextResponse.json({ error: "No tienes equipo asignado" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const promotor_id = searchParams.get("promotor_id") ? Number(searchParams.get("promotor_id")) : undefined;
  const tipo_cliente = searchParams.get("tipo_cliente") || undefined;
  const convenio = searchParams.get("convenio") || undefined;
  const estado = searchParams.get("estado") || undefined;
  const municipio = searchParams.get("municipio") || undefined;
  const tiene_telefono = searchParams.get("tiene_telefono") === "true" || searchParams.get("tiene_telefono") === "1";

  // Validate promotor belongs to team
  if (promotor_id) {
    const promotor = await prisma.usuarios.findUnique({
      where: { id: promotor_id },
      select: { equipo_id: true },
    });
    if (!promotor || promotor.equipo_id !== supervisor.equipo_id) {
      return NextResponse.json({ error: "Promotor no pertenece a tu equipo" }, { status: 403 });
    }
  }

  const targetUserId = promotor_id || supervisorId;

  // IDs to exclude
  const cooldownStr = await getConfig("cooldown_meses");
  const cooldownMeses = parseInt(cooldownStr || "3");
  const cooldownDate = new Date();
  cooldownDate.setMonth(cooldownDate.getMonth() - cooldownMeses);

  const excludeRows = await prisma.$queryRaw<{ cliente_id: number }[]>`
    SELECT DISTINCT cliente_id FROM oportunidades
    WHERE cliente_id IS NOT NULL
      AND (activo = true OR (usuario_id = ${targetUserId} AND created_at >= ${cooldownDate}))
  `;
  const excludeArray = excludeRows.map((r) => r.cliente_id);
  const baseExclude = excludeArray.length > 0 ? { id: { notIn: excludeArray } } : {};

  // Cupo for the target promotor
  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const maxPerDayStr = await getConfig("max_registros_por_dia");
  const maxPerDay = parseInt(maxPerDayStr || "300");

  let cupoRestante: number;
  try {
    const cupo = await prisma.cupo_diario.findUnique({
      where: { usuario_id_fecha: { usuario_id: targetUserId, fecha: today } },
    });
    cupoRestante = Math.max(0, maxPerDay - (cupo?.total_asignado ?? 0));
  } catch {
    const lotesHoy = await prisma.lotes.findMany({
      where: { usuario_id: targetUserId, fecha: { gte: today, lt: tomorrow } },
      select: { cantidad: true },
    });
    cupoRestante = Math.max(0, maxPerDay - lotesHoy.reduce((s, l) => s + l.cantidad, 0));
  }

  const [tiposRaw, conveniosRaw, estadosRaw, municipiosRaw, disponibles] = await Promise.all([
    prismaClientes.clientes.findMany({
      select: { tipo_cliente: true },
      distinct: ["tipo_cliente"],
      where: { ...baseExclude },
      orderBy: { tipo_cliente: "asc" },
    }),
    prismaClientes.clientes.findMany({
      select: { convenio: true },
      distinct: ["convenio"],
      where: {
        ...baseExclude,
        ...(tipo_cliente ? { tipo_cliente } : {}),
      },
      orderBy: { convenio: "asc" },
    }),
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
    convenios: conveniosRaw.map((r) => r.convenio).filter(Boolean),
    estados: estadosRaw.map((r) => r.estado).filter(Boolean),
    municipios: municipiosRaw.map((r) => (r as { municipio?: string | null }).municipio).filter(Boolean),
    disponibles,
    cupoRestante,
    cupoMaximo: maxPerDay,
    asignables: Math.min(disponibles, cupoRestante),
  });
}
