import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requirePromotor } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const { session, error } = await requirePromotor();
  if (error) return error;

  const userId = parseInt(session.user.id);
  const { searchParams } = new URL(req.url);

  const tipo_cliente = searchParams.get("tipo_cliente") || undefined;
  const convenio = searchParams.get("convenio") || undefined;
  const estado = searchParams.get("estado") || undefined;
  const municipio = searchParams.get("municipio") || undefined;
  const tiene_telefono = searchParams.get("tiene_telefono") === "true" || searchParams.get("tiene_telefono") === "1";

  // Excluir: activos (de cualquier promotor) + cooldown (del mismo promotor)
  const cooldownConfig = await prisma.configuracion.findUnique({
    where: { clave: "cooldown_meses" },
  });
  const cooldownMeses = parseInt(cooldownConfig?.valor || "3");
  const cooldownDate = new Date();
  cooldownDate.setMonth(cooldownDate.getMonth() - cooldownMeses);

  const excludeRows = await prisma.$queryRaw<{ cliente_id: number }[]>`
    SELECT DISTINCT cliente_id FROM oportunidades
    WHERE cliente_id IS NOT NULL
      AND (activo = true OR (usuario_id = ${userId} AND created_at >= ${cooldownDate}))
  `;
  const excludeIds = excludeRows.map((r) => r.cliente_id);

  const disponibles = await prismaClientes.clientes.count({
    where: {
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      ...(tipo_cliente ? { tipo_cliente } : {}),
      ...(convenio ? { convenio } : {}),
      ...(estado ? { estado } : {}),
      ...(municipio ? { municipio } : {}),
      ...(tiene_telefono ? { tel_1: { not: null } } : {}),
    },
  });

  // Cupo restante del día (timezone Mexico)
  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const config = await prisma.configuracion.findUnique({ where: { clave: "max_registros_por_dia" } });
  const maxPerDay = parseInt(config?.valor || "300");

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

  return NextResponse.json({ disponibles, cupoRestante, asignables: Math.min(disponibles, cupoRestante) });
}
