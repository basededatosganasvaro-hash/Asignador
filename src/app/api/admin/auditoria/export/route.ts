import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { logAccessWithSession } from "@/lib/access-log";

export async function GET(req: Request) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const usuario_id = searchParams.get("usuario_id");
  const accionParam = searchParams.get("accion");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const where: Prisma.access_logWhereInput = {};
  if (usuario_id) where.usuario_id = parseInt(usuario_id);
  if (accionParam) {
    const acciones = accionParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (acciones.length > 0) where.accion = { in: acciones };
  }
  if (desde || hasta) {
    where.created_at = {};
    if (desde) (where.created_at as Prisma.DateTimeFilter).gte = new Date(desde);
    if (hasta) {
      const d = new Date(hasta);
      d.setHours(23, 59, 59, 999);
      (where.created_at as Prisma.DateTimeFilter).lte = d;
    }
  }

  const rows = await prisma.access_log.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 50000,
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Auditoría");
  ws.columns = [
    { header: "Fecha/Hora", key: "created_at", width: 22 },
    { header: "Usuario ID", key: "usuario_id", width: 10 },
    { header: "Username", key: "username", width: 20 },
    { header: "Rol", key: "rol", width: 15 },
    { header: "Acción", key: "accion", width: 22 },
    { header: "Recurso", key: "recurso_id", width: 15 },
    { header: "Metadata", key: "metadata", width: 50 },
    { header: "IP", key: "ip", width: 18 },
    { header: "User-Agent", key: "user_agent", width: 50 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      created_at: r.created_at.toISOString().replace("T", " ").substring(0, 19),
      usuario_id: r.usuario_id,
      username: r.username,
      rol: r.rol,
      accion: r.accion,
      recurso_id: r.recurso_id,
      metadata: r.metadata ? JSON.stringify(r.metadata) : "",
      ip: r.ip,
      user_agent: r.user_agent,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fecha = new Date().toISOString().split("T")[0];

  logAccessWithSession(session, "export_excel", {
    metadata: { tipo: "auditoria", total: rows.length },
    req,
  });

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="auditoria_${fecha}.xlsx"`,
    },
  });
}
