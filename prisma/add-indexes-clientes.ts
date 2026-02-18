/**
 * Agrega índices de rendimiento a BD Clientes.
 * Ejecutar una sola vez: npm run prisma:index-clientes
 */
import { PrismaClient } from "../src/generated/prisma-clientes";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_CLIENTES_URL } },
});

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_clientes_tipo_cliente  ON clientes(tipo_cliente)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_convenio      ON clientes(convenio)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_estado        ON clientes(estado)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_municipio     ON clientes(municipio)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_estado_mun    ON clientes(estado, municipio)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_tel_1         ON clientes(tel_1)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_nss           ON clientes(nss)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_curp          ON clientes(curp)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_rfc           ON clientes(rfc)`,
];

async function main() {
  console.log("Creando índices en BD Clientes...");
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
