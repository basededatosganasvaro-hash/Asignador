import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAsesorDigital } from "@/lib/auth-utils";
import ExcelJS from "exceljs";

export async function GET() {
  const { session, error } = await requireAsesorDigital();
  if (error) return error;

  try {
    const registros = await prisma.ad_registros.findMany({
      where: { usuario_id: Number(session.user.id), activo: true },
      orderBy: { created_at: "desc" },
      take: 5000,
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Registros");

    ws.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Etapa", key: "etapa", width: 20 },
      { header: "Nombre Cliente", key: "nombre_cliente", width: 30 },
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Status", key: "status", width: 18 },
      { header: "Estrategia", key: "estrategia", width: 15 },
      { header: "Flujo", key: "flujo", width: 14 },
      { header: "Telefono", key: "numero_telefono", width: 15 },
      { header: "CURP", key: "curp", width: 20 },
      { header: "NSS", key: "nss", width: 15 },
      { header: "RFC", key: "rfc", width: 15 },
      { header: "Zona", key: "zona", width: 15 },
      { header: "Campaña", key: "campana", width: 18 },
      { header: "Capacidad", key: "capacidad", width: 15 },
      { header: "Monto Credito", key: "monto_credito", width: 15 },
      { header: "Tipo Credito", key: "tipo_credito", width: 18 },
      { header: "Convenio", key: "convenio", width: 18 },
      { header: "Etiqueta", key: "etiqueta", width: 12 },
      { header: "Oferta", key: "oferta", width: 8 },
      { header: "Motivo", key: "motivo", width: 25 },
      { header: "ID Venta", key: "id_venta", width: 12 },
      { header: "Viabilidad", key: "viabilidad", width: 15 },
    ];

    // Header style
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    });

    for (const r of registros) {
      ws.addRow({
        id: r.id,
        etapa: r.etapa,
        nombre_cliente: r.nombre_cliente,
        fecha: r.fecha ? new Date(r.fecha).toLocaleDateString("es-MX") : "",
        status: r.status,
        estrategia: r.estrategia,
        flujo: r.flujo,
        numero_telefono: r.numero_telefono,
        curp: r.curp,
        nss: r.nss,
        rfc: r.rfc,
        zona: r.zona,
        campana: r.campana,
        capacidad: r.capacidad,
        monto_credito: r.monto_credito ? Number(r.monto_credito) : null,
        tipo_credito: r.tipo_credito,
        convenio: r.convenio,
        etiqueta: r.etiqueta,
        oferta: r.oferta,
        motivo: r.motivo,
        id_venta: r.id_venta,
        viabilidad: r.viabilidad,
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="registros_asesor_digital_${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Error generando export:", err);
    return NextResponse.json({ error: "Error al generar el archivo" }, { status: 500 });
  }
}
