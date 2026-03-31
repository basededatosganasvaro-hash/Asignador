/**
 * Script para importar Bd Cdmx.xlsx → tabla clientes_cdmx
 * Ejecutar: npx tsx scripts/importar-cdmx.ts
 */
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import path from "path";

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val);
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseDecimal(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function parseInt2(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : Math.floor(n);
}

function str(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val).trim() || null;
}

async function main() {
  const filePath = path.resolve(__dirname, "../Docs/Bd Cdmx.xlsx");
  console.log(`Leyendo archivo: ${filePath}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet("Base Cobranza") || wb.worksheets[0];
  if (!ws) throw new Error("No se encontró la hoja de cálculo");

  console.log(`Filas totales: ${ws.rowCount}`);

  // Borrar datos existentes antes de reimportar
  const existentes = await prisma.clientes_cdmx.count();
  if (existentes > 0) {
    console.log(`Borrando ${existentes} registros existentes...`);
    await prisma.$executeRawUnsafe("TRUNCATE TABLE clientes_cdmx RESTART IDENTITY");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let batch: any[] = [];
  let total = 0;

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    // Skip empty rows
    if (!row.getCell(5).value) continue;

    batch.push({
      nomina: str(row.getCell(1).value),
      institucion: str(row.getCell(2).value),
      numero_empleado: parseInt2(row.getCell(3).value),
      rfc: str(row.getCell(4).value),
      nombre: str(row.getCell(5).value),
      puesto: str(row.getCell(6).value),
      contrato: parseInt2(row.getCell(7).value),
      cod_institucion: str(row.getCell(8).value),
      fecha: parseDate(row.getCell(9).value),
      servicio: str(row.getCell(10).value),
      clave_descuento: str(row.getCell(11).value),
      cuotas_original: parseInt2(row.getCell(12).value),
      cuotas: parseInt2(row.getCell(13).value),
      valor_original: parseDecimal(row.getCell(14).value),
      valor_enviado: parseDecimal(row.getCell(15).value),
      valor_descontado: parseDecimal(row.getCell(16).value),
      critica_envio: str(row.getCell(17).value),
      regreso: str(row.getCell(18).value),
      periodo_bloqueo: str(row.getCell(19).value),
      ultimo_periodo: parseInt2(row.getCell(20).value),
      procesamiento: parseDate(row.getCell(21).value),
      descentralizado: str(row.getCell(22).value),
      cambio_manual: str(row.getCell(23).value),
      fecha_ingreso: parseDate(row.getCell(24).value),
      eventos: str(row.getCell(25).value),
    });

    if (batch.length >= BATCH_SIZE) {
      await prisma.clientes_cdmx.createMany({ data: batch });
      total += batch.length;
      console.log(`Importados: ${total}`);
      batch = [];
    }
  }

  // Batch final
  if (batch.length > 0) {
    await prisma.clientes_cdmx.createMany({ data: batch });
    total += batch.length;
  }

  console.log(`\nImportación completa: ${total} registros insertados`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
