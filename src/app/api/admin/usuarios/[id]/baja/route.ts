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

  // Validar receptor: debe existir, estar activo, ser promotor y pertenecer al mismo equipo
  const receptor = await prisma.usuarios.findUnique({
    where: { id: receptorId },
    select: { id: true, activo: true, rol: true, equipo_id: true },
  });

  if (!receptor) {
    return NextResponse.json({ error: "El receptor no existe" }, { status: 404 });
  }
  if (!receptor.activo) {
    return NextResponse.json({ error: "El receptor no está activo" }, { status: 400 });
  }
  if (receptor.rol !== "promotor") {
    return NextResponse.json({ error: "El receptor debe tener rol promotor" }, { status: 400 });
  }
  if (receptor.equipo_id !== promotor.equipo_id) {
    return NextResponse.json({ error: "El receptor debe pertenecer al mismo equipo que el promotor dado de baja" }, { status: 400 });
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
