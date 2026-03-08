import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorOrAdmin } from "@/lib/auth-utils";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSupervisorOrAdmin();
  if (error) return error;

  const { id } = await params;
  const userId = Number(session!.user.id);
  const body = await req.json();
  if (!body.receptor_id) {
    return NextResponse.json({ error: "receptor_id es requerido" }, { status: 400 });
  }
  const receptorId = Number(body.receptor_id);
  if (isNaN(receptorId) || receptorId === Number(id)) {
    return NextResponse.json({ error: "receptor_id invalido o igual al promotor a dar de baja" }, { status: 400 });
  }

  const promotor = await prisma.usuarios.findUnique({
    where: { id: Number(id) },
    select: { id: true, nombre: true, activo: true, rol: true, equipo_id: true },
  });

  if (!promotor || !promotor.activo) {
    return NextResponse.json({ error: "Promotor no encontrado o ya inactivo" }, { status: 404 });
  }
  if (promotor.rol !== "promotor") {
    return NextResponse.json({ error: "Solo se puede dar de baja a promotores" }, { status: 400 });
  }

  // Si es supervisor, validar que el promotor pertenezca a su equipo
  if (session!.user.rol === "supervisor") {
    const equipoSupervisor = await prisma.equipos.findFirst({
      where: { supervisor_id: userId },
      select: { id: true },
    });
    if (!equipoSupervisor || promotor.equipo_id !== equipoSupervisor.id) {
      return NextResponse.json({ error: "Solo puedes dar de baja a promotores de tu equipo" }, { status: 403 });
    }
  }

  // Buscar todas sus oportunidades activas
  const oportunidades = await prisma.oportunidades.findMany({
    where: { usuario_id: Number(id), activo: true },
    select: { id: true },
  });

  await prisma.$transaction([
    // Dar de baja al promotor
    prisma.usuarios.update({
      where: { id: Number(id) },
      data: { activo: false },
    }),
    // Transferir sus oportunidades
    prisma.oportunidades.updateMany({
      where: { usuario_id: Number(id), activo: true },
      data: { usuario_id: receptorId, origen: "REASIGNACION" },
    }),
    // Registrar en historial
    prisma.historial.createMany({
      data: oportunidades.map((op) => ({
        oportunidad_id: op.id,
        usuario_id: userId,
        tipo: "REASIGNACION",
        nota: `Baja de promotor ${promotor.nombre} — oportunidad transferida`,
      })),
    }),
  ]);

  return NextResponse.json({ transferidas: oportunidades.length });
}
