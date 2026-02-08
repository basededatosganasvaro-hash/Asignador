import ExcelJS from "exceljs";

interface ClienteExcel {
  nombres: string | null;
  tel_1: string | null;
}

export async function generateExcelBuffer(
  registros: ClienteExcel[],
  asignacionId: number
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Asignacion");

  // Encabezados
  sheet.columns = [
    { header: "Nombre", key: "nombres", width: 40 },
    { header: "Telefono", key: "tel_1", width: 20 },
  ];

  // Estilo de encabezados
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1565C0" },
    };
    cell.alignment = { horizontal: "center" };
  });

  // Datos
  registros.forEach((r) => {
    sheet.addRow({
      nombres: r.nombres || "",
      tel_1: r.tel_1 || "",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
