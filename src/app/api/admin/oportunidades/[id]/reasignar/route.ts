import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorOrAdmin } from "@/lib/auth-utils";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSupervisorOrAdmin();
  if (error) return error;

  const { id } = await params;
  const userId = Number(session!.user.id);
  const rol = session!.user.rol;
  const body = await req.json();
  const { nuevo_usuario_id } = body;

  if (!nuevo_usuario_id) {
    return NextResponse.json({ error: "nuevo_usuario_id es requerido" }, { status: 400 });
  }

  const op = await prisma.oportunidades.findUnique({
    where: { id: Number(id) },
    include: { usuario: { select: { equipo_id: true } } },
  });

  if (!op || !op.activo) {
    return NextResponse.json({ error: "Oportunidad no encontrada o inactiva" }, { status: 404 });
  }

  const nuevoPromotor = await prisma.usuarios.findUnique({
    where: { id: Number(nuevo_usuario_id) },
    select: { id: true, nombre: true, rol: true, activo: true, equipo_id: true },
  });

  if (!nuevoPromotor || !nuevoPromotor.activo || nuevoPromotor.rol !== "promotor") {
    return NextResponse.json({ error: "El usuario destino debe ser un promotor activo" }, { status: 400 });
  }

  // Supervisor solo puede reasignar dentro de su equipo
  if (rol === "supervisor") {
    const sup = await prisma.usuarios.findUnique({ where: { id: userId }, select: { equipo_id: true } });
    if (nuevoPromotor.equipo_id !== sup?.equipo_id) {
      return NextResponse.json({ error: "Solo puedes reasignar dentro de tu equipo" }, { status: 403 });
    }
  }

  await prisma.$transaction([
    prisma.oportunidades.update({
      where: { id: Number(id) },
      data: { usuario_id: Number(nuevo_usuario_id), origen: "REASIGNACION" },
    }),
    prisma.historial.create({
      data: {
        oportunidad_id: Number(id),
        usuario_id: userId,
        tipo: "REASIGNACION",
        nota: `Reasignado a ${nuevoPromotor.nombre}`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
