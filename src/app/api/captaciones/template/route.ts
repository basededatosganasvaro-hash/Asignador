import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import ExcelJS from "exceljs";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Captaciones");

  const columns = [
    { header: "nombres", key: "nombres", width: 25 },
    { header: "a_paterno", key: "a_paterno", width: 20 },
    { header: "a_materno", key: "a_materno", width: 20 },
    { header: "tel_1", key: "tel_1", width: 18 },
    { header: "nss", key: "nss", width: 18 },
    { header: "curp", key: "curp", width: 22 },
    { header: "rfc", key: "rfc", width: 18 },
    { header: "num_empleado", key: "num_empleado", width: 18 },
    { header: "tel_2", key: "tel_2", width: 18 },
    { header: "estado", key: "estado", width: 18 },
    { header: "municipio", key: "municipio", width: 18 },
    { header: "email", key: "email", width: 28 },
  ];

  sheet.columns = columns;

  // Estilo del header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1565C0" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 28;

  // Marcar requeridos vs opcionales
  const requiredCols = [1, 2, 3, 4]; // nombres, a_paterno, a_materno, tel_1
  for (let col = 1; col <= columns.length; col++) {
    const cell = headerRow.getCell(col);
    if (requiredCols.includes(col)) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1565C0" }, // azul fuerte = requerido
      };
    } else {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF78909C" }, // gris = opcional
      };
    }
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  }

  // Fila de ejemplo
  sheet.addRow({
    nombres: "Juan Carlos",
    a_paterno: "Pérez",
    a_materno: "López",
    tel_1: "5512345678",
    nss: "",
    curp: "",
    rfc: "",
    num_empleado: "",
    tel_2: "",
    estado: "",
    municipio: "",
    email: "",
  });
  const exampleRow = sheet.getRow(2);
  exampleRow.font = { italic: true, color: { argb: "FF999999" } };

  // Nota en la fila 4
  sheet.mergeCells("A4:L4");
  const noteCell = sheet.getCell("A4");
  noteCell.value = "Azul = requerido | Gris = opcional. Borra esta fila de ejemplo antes de llenar tus datos.";
  noteCell.font = { italic: true, size: 10, color: { argb: "FF666666" } };

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=template_captaciones.xlsx",
    },
  });
}
