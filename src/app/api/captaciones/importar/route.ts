import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { verificarHorarioConConfig } from "@/lib/horario";
import ExcelJS from "exceljs";

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  // Validar horario operativo
  const horario = await verificarHorarioConConfig();
  if (!horario.activo) {
    return NextResponse.json({ error: horario.mensaje }, { status: 403 });
  }

  const userId = Number(session!.user.id);
  const rol = session!.user.rol;

  if (!["promotor", "supervisor"].includes(rol)) {
    return NextResponse.json({ error: "Solo promotores y supervisores pueden importar" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const origen_captacion = formData.get("origen_captacion") as string;
  const convenio = formData.get("convenio") as string;

  if (!file || !origen_captacion || !convenio) {
    return NextResponse.json({ error: "Archivo, origen y convenio son requeridos" }, { status: 400 });
  }

  // Leer Excel
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];

  if (!sheet || sheet.rowCount < 2) {
    return NextResponse.json({ error: "El archivo está vacío o no tiene datos" }, { status: 400 });
  }

  // Leer headers de la fila 1
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || "").trim().toLowerCase().replace(/\s+/g, "_");
  });

  // Mapeo flexible de nombres de columna
  const ALIASES: Record<string, string[]> = {
    nombres: ["nombres", "nombre", "name"],
    a_paterno: ["a_paterno", "apellido_paterno", "paterno"],
    a_materno: ["a_materno", "apellido_materno", "materno"],
    tel_1: ["tel_1", "telefono", "telefono_1", "tel"],
    tel_2: ["tel_2", "telefono_2"],
    nss: ["nss"],
    curp: ["curp"],
    rfc: ["rfc"],
    num_empleado: ["num_empleado", "numero_empleado", "no_empleado"],
    estado: ["estado"],
    municipio: ["municipio"],
    direccion_email: ["direccion_email", "email", "correo"],
  };

  // Resolver qué columna mapea a qué campo
  const colMap: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const colIdx = headers.findIndex((h) => h === alias);
      if (colIdx !== -1) {
        colMap[field] = colIdx;
        break;
      }
    }
  }

  // Validar campos mínimos
  if (!("nombres" in colMap) && !("a_paterno" in colMap)) {
    return NextResponse.json(
      { error: "El archivo debe tener al menos una columna de nombre (nombres, nombre, apellido_paterno)" },
      { status: 400 }
    );
  }
  if (!("tel_1" in colMap)) {
    return NextResponse.json(
      { error: "El archivo debe tener una columna de teléfono (tel_1, telefono)" },
      { status: 400 }
    );
  }

  // Obtener reglas del convenio
  const reglas = await prisma.convenio_reglas.findMany({ where: { convenio } });

  // Etapa y timer
  const etapaAsignado = await prisma.embudo_etapas.findFirst({
    where: { nombre: "Asignado", activo: true },
  });
  const timerConfig = await prisma.configuracion.findUnique({
    where: { clave: "timer_captacion_horas" },
  });
  const timerHoras = timerConfig ? Number(timerConfig.valor) : 168;

  // Parsear filas
  const rows: { rowNum: number; datos: Record<string, string> }[] = [];
  const errors: { row: number; message: string }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const datos: Record<string, string> = {};
    for (const [field, colIdx] of Object.entries(colMap)) {
      const cellValue = row.getCell(colIdx + 1).value;
      if (cellValue !== null && cellValue !== undefined) {
        datos[field] = String(cellValue).trim();
      }
    }

    // Validar mínimos
    if (!datos.nombres && !(datos.a_paterno || datos.a_materno)) {
      errors.push({ row: rowNumber, message: "Sin nombre" });
      return;
    }
    if (!datos.tel_1) {
      errors.push({ row: rowNumber, message: "Sin teléfono" });
      return;
    }

    // Validar campos obligatorios del convenio
    const faltantes = reglas.filter((r) => r.obligatorio && !datos[r.campo]);
    if (faltantes.length > 0) {
      errors.push({ row: rowNumber, message: `Faltan: ${faltantes.map((r) => r.campo).join(", ")}` });
      return;
    }

    rows.push({ rowNum: rowNumber, datos });
  });

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No hay filas válidas para importar", errors },
      { status: 400 }
    );
  }

  // Crear oportunidades en batches para reducir duración de transacciones
  const timerVence = new Date(Date.now() + timerHoras * 60 * 60 * 1000);
  let created = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    try {
      await prisma.$transaction(async (tx) => {
        // Create oportunidades one by one to get IDs (createMany doesn't return IDs)
        const createdOps: { id: number; datos: Record<string, string>; rowNum: number }[] = [];

        for (const { rowNum, datos } of batch) {
          const op = await tx.oportunidades.create({
            data: {
              cliente_id: null,
              usuario_id: userId,
              etapa_id: etapaAsignado?.id ?? null,
              origen: "CAPTACION",
              timer_vence: timerVence,
              activo: true,
            },
            select: { id: true },
          });
          createdOps.push({ id: op.id, datos, rowNum });
        }

        // Batch insert captaciones and historial
        await tx.captaciones.createMany({
          data: createdOps.map((op) => ({
            oportunidad_id: op.id,
            usuario_id: userId,
            origen_captacion,
            convenio,
            datos_json: op.datos,
          })),
        });

        await tx.historial.createMany({
          data: createdOps.map((op) => ({
            oportunidad_id: op.id,
            usuario_id: userId,
            tipo: "CAPTACION",
            etapa_nueva_id: etapaAsignado?.id ?? null,
            nota: `Importación masiva — fila ${op.rowNum}`,
          })),
        });

        created += createdOps.length;
      });
    } catch {
      // Mark all rows in this batch as failed
      for (const { rowNum } of batch) {
        errors.push({ row: rowNum, message: "Error al crear registro (batch)" });
      }
    }
  }

  return NextResponse.json({ created, errors }, { status: 201 });
}
