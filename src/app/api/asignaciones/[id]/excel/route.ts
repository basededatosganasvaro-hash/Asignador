import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";
import { generateExcelBuffer } from "@/lib/excel";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const loteId = parseInt(id);
  const userId = parseInt(session.user.id);

  // 1. Verificar propiedad del lote (BD Sistema)
  const lote = await prisma.lotes.findUnique({
    where: { id: loteId },
    include: {
      oportunidades: {
        where: { activo: true },
        select: { cliente_id: true },
      },
    },
  });

  if (!lote) {
    return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  }

  if (lote.usuario_id !== userId && session.user.rol !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const clienteIds = lote.oportunidades.map((o) => o.cliente_id);

  if (clienteIds.length === 0) {
    return NextResponse.json({ error: "El lote no tiene registros activos" }, { status: 400 });
  }

  // 2. Obtener datos originales (BD Clientes)
  const clientes = await prismaClientes.clientes.findMany({
    where: { id: { in: clienteIds } },
    select: { id: true, nombres: true, tel_1: true },
  });

  // 3. Obtener ediciones de tel_1 (BD Sistema)
  const ediciones = await prisma.datos_contacto.findMany({
    where: { cliente_id: { in: clienteIds }, campo: "tel_1" },
    orderBy: { created_at: "asc" },
  });
  const tel1EditMap = new Map(ediciones.map((e) => [e.cliente_id, e.valor]));

  // 4. Merge y validar completitud
  const registros = clientes.map((c) => ({
    nombres: c.nombres,
    tel_1: tel1EditMap.get(c.id) ?? c.tel_1,
  }));

  const incompletos = registros.filter((r) => !r.tel_1 || r.tel_1.trim() === "");
  if (incompletos.length > 0) {
    return NextResponse.json(
      {
        error: "No todos los registros tienen telefono",
        faltantes: incompletos.length,
        total: registros.length,
      },
      { status: 400 }
    );
  }

  // 5. Generar Excel
  const buffer = await generateExcelBuffer(registros, loteId);
  const fecha = lote.fecha.toISOString().split("T")[0];

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lote_${loteId}_${fecha}.xlsx"`,
    },
  });
}
