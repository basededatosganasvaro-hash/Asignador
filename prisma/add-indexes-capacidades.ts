/**
 * Agrega índices de rendimiento a BD Capacidades.
 * Ejecutar una sola vez: npm run prisma:index-capacidades
 */
import { PrismaClient } from "../src/generated/prisma-capacidades";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_CAPACIDADES_URL } },
});

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_solicitudes_user_estado ON solicitudes(user_id, estado)`,
];

async function main() {
  console.log("Creando índices en BD Capacidades...");
  for (const sql of INDEXES) {
    const name = sql.match(/idx_\w+/)?.[0] ?? sql;
    process.stdout.write(`  ${name} ... `);
    await prisma.$executeRawUnsafe(sql);
    console.log("ok");
  }
  console.log("Listo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
