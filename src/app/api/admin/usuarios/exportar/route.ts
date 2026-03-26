import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import ExcelJS from "exceljs";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const usuarios = await prisma.usuarios.findMany({
    select: {
      id: true,
      nombre: true,
      username: true,
      rol: true,
      telegram_id: true,
      activo: true,
      created_at: true,
      region: { select: { nombre: true } },
      sucursal: { select: { nombre: true } },
      equipo: { select: { nombre: true } },
      _count: { select: { lotes: true, oportunidades: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Usuarios");

  sheet.columns = [
    { header: "Nombre", key: "nombre", width: 30 },
    { header: "Username", key: "username", width: 20 },
    { header: "Rol", key: "rol", width: 18 },
    { header: "Región", key: "region", width: 20 },
    { header: "Sucursal", key: "sucursal", width: 20 },
    { header: "Equipo", key: "equipo", width: 20 },
    { header: "Telegram ID", key: "telegram_id", width: 15 },
    { header: "Lotes", key: "lotes", width: 10 },
    { header: "Oportunidades", key: "oportunidades", width: 15 },
    { header: "Activo", key: "activo", width: 10 },
    { header: "Fecha creación", key: "created_at", width: 15 },
  ];

  // Header styling
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A237E" } };
  });

  for (const u of usuarios) {
    sheet.addRow({
      nombre: u.nombre,
      username: u.username ?? "—",
      rol: u.rol,
      region: u.region?.nombre ?? "—",
      sucursal: u.sucursal?.nombre ?? "—",
      equipo: u.equipo?.nombre ?? "—",
      telegram_id: u.telegram_id ? String(u.telegram_id) : "—",
      lotes: u._count.lotes,
      oportunidades: u._count.oportunidades,
      activo: u.activo ? "Sí" : "No",
      created_at: new Date(u.created_at).toLocaleDateString("es-MX"),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`,
    },
  });
}
