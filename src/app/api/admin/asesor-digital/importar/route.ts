import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import ExcelJS from "exceljs";

// Column mapping: Excel column index (0-based) → field name
const COLUMN_MAP: { idx: number; field: string; required?: boolean }[] = [
  { idx: 0, field: "nombre_cliente", required: true },
  { idx: 1, field: "fecha" },
  { idx: 2, field: "status" },
  { idx: 3, field: "estrategia" },
  { idx: 4, field: "flujo" },
  { idx: 5, field: "numero_telefono" },
  { idx: 6, field: "curp" },
  { idx: 7, field: "nss" },
  { idx: 8, field: "rfc" },
  { idx: 9, field: "zona" },
  { idx: 10, field: "campana" },
  { idx: 11, field: "capacidad" },
  { idx: 12, field: "monto_credito" },
  { idx: 13, field: "tipo_credito" },
  { idx: 14, field: "convenio" },
  { idx: 15, field: "etiqueta" },
  { idx: 16, field: "oferta" },
  { idx: 17, field: "motivo" },
  { idx: 18, field: "id_venta" },
  { idx: 19, field: "viabilidad" },
  { idx: 20, field: "etapa" },
];

// Max lengths matching schema VarChar definitions
const FIELD_MAX_LEN: Record<string, number> = {
  nombre_cliente: 300,
  etapa: 30,
  status: 30,
  estrategia: 30,
  flujo: 20,
  numero_telefono: 20,
  curp: 18,
  nss: 15,
  rfc: 13,
  zona: 100,
  campana: 30,
  capacidad: 100,
  tipo_credito: 30,
  convenio: 100,
  etiqueta: 20,
  oferta: 5,
  id_venta: 100,
  viabilidad: 100,
};

function truncate(val: string | null, field: string): string | null {
  if (!val) return null;
  const max = FIELD_MAX_LEN[field];
  return max && val.length > max ? val.slice(0, max) : val;
}

const ETAPAS_VALIDAS = ["Leads", "Cotizacion", "No sujeto a credito", "Ventas"];
const STATUS_VALIDOS = ["Venta", "Interesado", "Cotizacion", "No viable", "Proceso", "Sin informacion"];

function cellToString(cell: ExcelJS.CellValue): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object" && cell !== null && "text" in (cell as object)) {
    return String((cell as unknown as { text: string }).text).trim();
  }
  return String(cell).trim();
}

function parseDate(val: ExcelJS.CellValue): Date {
  if (val instanceof Date) return val;
  const s = cellToString(val);
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  // Find the asesor_digital user
  const asesor = await prisma.usuarios.findFirst({
    where: { rol: "asesor_digital", activo: true },
    select: { id: true },
  });

  if (!asesor) {
    return NextResponse.json(
      { error: "No existe un usuario con rol asesor_digital activo" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No se envio ningun archivo" }, { status: 400 });
  }

  const arrayBuf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuf as unknown as ExcelJS.Buffer);

  const ws = wb.worksheets[0];
  if (!ws) {
    return NextResponse.json({ error: "El archivo no contiene hojas" }, { status: 400 });
  }

  const registros: {
    usuario_id: number;
    etapa: string;
    nombre_cliente: string;
    fecha: Date;
    status: string;
    estrategia: string | null;
    flujo: string | null;
    numero_telefono: string | null;
    curp: string | null;
    nss: string | null;
    rfc: string | null;
    zona: string | null;
    campana: string | null;
    capacidad: string | null;
    monto_credito: number | null;
    tipo_credito: string | null;
    convenio: string | null;
    etiqueta: string | null;
    oferta: string | null;
    motivo: string | null;
    id_venta: string | null;
    viabilidad: string | null;
  }[] = [];
  const errores: string[] = [];
  let insertados = 0;

  // Skip header row (row 1), process from row 2
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const values: Record<string, string> = {};
    for (const col of COLUMN_MAP) {
      values[col.field] = cellToString(row.getCell(col.idx + 1).value);
    }

    // Validate required fields
    if (!values.nombre_cliente) {
      errores.push(`Fila ${rowNumber}: Nombre Cliente vacio`);
      return;
    }

    // Normalize etapa
    let etapa = values.etapa || "Leads";
    if (!ETAPAS_VALIDAS.includes(etapa)) {
      // Try case-insensitive match
      const found = ETAPAS_VALIDAS.find(
        (e) => e.toLowerCase() === etapa.toLowerCase()
      );
      if (found) {
        etapa = found;
      } else {
        errores.push(`Fila ${rowNumber}: Etapa invalida "${etapa}"`);
        return;
      }
    }

    // Normalize status
    let status = values.status || "Sin informacion";
    if (!STATUS_VALIDOS.includes(status)) {
      const found = STATUS_VALIDOS.find(
        (s) => s.toLowerCase() === status.toLowerCase()
      );
      if (found) {
        status = found;
      } else {
        status = "Sin informacion";
      }
    }

    const montoRaw = values.monto_credito;
    const monto = montoRaw ? Number(montoRaw.replace(/[,$]/g, "")) : null;

    registros.push({
      usuario_id: asesor.id,
      etapa,
      nombre_cliente: truncate(values.nombre_cliente, "nombre_cliente")!,
      fecha: parseDate(row.getCell(2).value),
      status,
      estrategia: truncate(values.estrategia, "estrategia"),
      flujo: truncate(values.flujo, "flujo"),
      numero_telefono: truncate(values.numero_telefono, "numero_telefono"),
      curp: truncate(values.curp, "curp"),
      nss: truncate(values.nss, "nss"),
      rfc: truncate(values.rfc, "rfc"),
      zona: truncate(values.zona, "zona"),
      campana: truncate(values.campana, "campana"),
      capacidad: truncate(values.capacidad, "capacidad"),
      monto_credito: monto && !isNaN(monto) ? monto : null,
      tipo_credito: truncate(values.tipo_credito, "tipo_credito"),
      convenio: truncate(values.convenio, "convenio"),
      etiqueta: truncate(values.etiqueta, "etiqueta"),
      oferta: truncate(values.oferta, "oferta"),
      motivo: values.motivo || null,
      id_venta: truncate(values.id_venta, "id_venta"),
      viabilidad: truncate(values.viabilidad, "viabilidad"),
    });
  });

  // Bulk insert in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < registros.length; i += BATCH_SIZE) {
    const batch = registros.slice(i, i + BATCH_SIZE);
    try {
      await prisma.ad_registros.createMany({ data: batch });
      insertados += batch.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      errores.push(`Error en lote ${Math.floor(i / BATCH_SIZE) + 1}: ${msg}`);
    }
  }

  return NextResponse.json({
    insertados,
    errores: errores.length,
    detalles: errores.length > 0 ? errores : undefined,
  });
}
