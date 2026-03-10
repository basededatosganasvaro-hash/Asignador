/**
 * Deduplicar num_operacion en ventas ANTES de aplicar @unique constraint.
 * Si hay duplicados, mantiene el registro más reciente y elimina los demás.
 * Idempotente: si no hay duplicados, no hace nada.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Buscar duplicados
    const duplicados = await prisma.$queryRaw<
      { num_operacion: string; cnt: bigint }[]
    >`
      SELECT num_operacion, COUNT(*) as cnt
      FROM ventas
      GROUP BY num_operacion
      HAVING COUNT(*) > 1
    `;

    if (duplicados.length === 0) {
      console.log("[dedup-ventas] No hay duplicados en num_operacion. OK.");
      return;
    }

    console.log(
      `[dedup-ventas] Encontrados ${duplicados.length} num_operacion duplicados. Limpiando...`
    );

    let totalEliminados = 0;

    for (const dup of duplicados) {
      // Mantener el registro más reciente (mayor id), eliminar los demás
      const eliminados = await prisma.$executeRawUnsafe(
        `DELETE FROM ventas
         WHERE num_operacion = $1
           AND id NOT IN (
             SELECT id FROM ventas
             WHERE num_operacion = $1
             ORDER BY id DESC
             LIMIT 1
           )`,
        dup.num_operacion
      );
      totalEliminados += eliminados;
      console.log(
        `[dedup-ventas] num_operacion="${dup.num_operacion}": eliminados ${eliminados} duplicados`
      );
    }

    console.log(
      `[dedup-ventas] Limpieza completada. ${totalEliminados} registros eliminados.`
    );
  } catch (e) {
    console.error("[dedup-ventas] Error:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
