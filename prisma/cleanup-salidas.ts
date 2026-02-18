import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Buscar etapas de salida
  const etapasSalida = await prisma.embudo_etapas.findMany({
    where: {
      OR: [
        { tipo: "SALIDA" },
        { tipo: "FINAL", nombre: { not: "Venta" } },
      ],
    },
  });

  const salidaIds = etapasSalida.map((e) => e.id);
  console.log(`Etapas de salida: ${etapasSalida.map((e) => `${e.nombre} (${e.id})`).join(", ")}`);

  // Buscar oportunidades activas en etapas de salida
  const opsEnSalida = await prisma.oportunidades.findMany({
    where: {
      activo: true,
      etapa_id: { in: salidaIds },
    },
    include: { etapa: true },
  });

  console.log(`\nOportunidades activas en salida: ${opsEnSalida.length}`);

  if (opsEnSalida.length === 0) {
    console.log("No hay oportunidades que limpiar.");
    return;
  }

  for (const op of opsEnSalida) {
    console.log(`  - Op #${op.id}: etapa "${op.etapa?.nombre}" → desactivar`);
  }

  // Desactivar todas
  const result = await prisma.oportunidades.updateMany({
    where: {
      activo: true,
      etapa_id: { in: salidaIds },
    },
    data: {
      activo: false,
      etapa_id: null,
      timer_vence: null,
    },
  });

  console.log(`\n✓ ${result.count} oportunidades desactivadas y devueltas al pool`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
