import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // Verificar cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Buscar todos los lotes de calificación promotor que no estén devueltos
  const lotesActivos = await prisma.lotes_calificacion_promotor.findMany({
    where: {
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
  });

  if (lotesActivos.length === 0) {
    return NextResponse.json({ mensaje: "No hay lotes activos para devolver", devueltos: 0 });
  }

  // Marcar todos como DEVUELTO
  const ids = lotesActivos.map((l) => l.id);
  await prisma.lotes_calificacion_promotor.updateMany({
    where: { id: { in: ids } },
    data: { estado: "DEVUELTO" },
  });

  return NextResponse.json({
    mensaje: `Se devolvieron ${ids.length} lotes`,
    devueltos: ids.length,
  });
}
