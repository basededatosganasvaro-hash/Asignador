/**
 * Seed: catálogo retroalimentación + rondas calificación
 * Ejecutar: npx tsx scripts/seed-calificacion-promotor.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Catálogo retroalimentación
  const estatus = [
    "Contesto",
    "No contesto",
    "Interesado",
    "No interesado",
    "No localizado",
  ];

  for (const nombre of estatus) {
    await prisma.catalogo_retroalimentacion.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }
  console.log(`Catálogo retroalimentación: ${estatus.length} registros`);

  // Rondas de calificación
  for (const tipo of ["IEPPO", "CDMX"]) {
    await prisma.rondas_calificacion.upsert({
      where: { tipo },
      update: {},
      create: { tipo, ronda_actual: 1 },
    });
  }
  console.log("Rondas calificación: IEPPO=1, CDMX=1");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
