import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_SISTEMA_URL } },
});

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseDecimal(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return null; // Excel sometimes stores dates in numeric cells
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function parseString(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim();
}

function parseInt2(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : Math.floor(n);
}

async function main() {
  // Check if data already exists
  const count = await prisma.clientes_pensionados.count();
  if (count > 0) {
    console.log(`La tabla ya tiene ${count} registros. Abortando para evitar duplicados.`);
    return;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("Docs/Pensionados Jalisco.xlsx");
  const ws = wb.worksheets[0];

  console.log(`Leyendo ${ws.rowCount - 1} filas...`);

  const batch: Record<string, unknown>[] = [];
  const BATCH_SIZE = 500;
  let imported = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    batch.push({
      id_sol_pr_financiero: parseInt2(row.getCell(1).value),
      id_inst_financiera: parseInt2(row.getCell(2).value),
      zona: parseString(row.getCell(3).value),
      nss: parseString(row.getCell(4).value),
      id_grupo_familiar: parseInt2(row.getCell(5).value),
      id_movimiento: parseString(row.getCell(6).value),
      curp: parseString(row.getCell(7).value),
      nombre: parseString(row.getCell(8).value),
      a_paterno: parseString(row.getCell(9).value),
      a_materno: parseString(row.getCell(10).value),
      num_clabe: parseString(String(row.getCell(11).value ?? "")),
      imp_prestamo: parseDecimal(row.getCell(12).value),
      num_meses: parseInt2(row.getCell(13).value),
      fec_alta: parseDate(row.getCell(14).value),
      fec_modificacion: parseDate(row.getCell(15).value),
      imp_mensual: parseDecimal(row.getCell(16).value),
      fec_inicio_prestamo: parseString(row.getCell(17).value),
      fec_term_prestamo: parseString(row.getCell(18).value),
      imp_saldo_pendiente: parseDecimal(row.getCell(19).value),
      num_tasa_int_anual: parseDecimal(row.getCell(20).value),
      cat_prestamo: parseDecimal(row.getCell(21).value),
      imp_real_prestamo: parseDecimal(row.getCell(22).value),
      ind_carta_instruccion: parseString(row.getCell(23).value),
      tasa_efectiva: parseDecimal(row.getCell(24).value),
      tasa_efec_redondeada: parseDecimal(row.getCell(25).value),
    });

    if (batch.length >= BATCH_SIZE) {
      await prisma.clientes_pensionados.createMany({ data: batch });
      imported += batch.length;
      console.log(`  ${imported} registros importados...`);
      batch.length = 0;
    }
  }

  // Last batch
  if (batch.length > 0) {
    await prisma.clientes_pensionados.createMany({ data: batch });
    imported += batch.length;
  }

  console.log(`\nImportación completada: ${imported} registros de Pensionados Jalisco`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
