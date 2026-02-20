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
    include: {
      usuario: { select: { equipo_id: true } },
      etapa: { select: { tipo: true } },
    },
  });

  if (!op || !op.activo) {
    return NextResponse.json({ error: "Oportunidad no encontrada o inactiva" }, { status: 404 });
  }

  // No permitir reasignar oportunidades en etapa FINAL o SALIDA
  if (op.etapa?.tipo === "FINAL" || op.etapa?.tipo === "SALIDA") {
    return NextResponse.json({ error: "No se puede reasignar una oportunidad en etapa final o de salida" }, { status: 400 });
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

  // Fecha de hoy para cupo
  const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const today = new Date(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate());

  const config = await prisma.configuracion.findUnique({
    where: { clave: "max_registros_por_dia" },
  });
  const maxPerDay = parseInt(config?.valor || "300");

  try {
    await prisma.$transaction(async (tx) => {
      // Verificar cupo del promotor destino con lock atómico
      await tx.$executeRaw`
        INSERT INTO cupo_diario (usuario_id, fecha, total_asignado, limite)
        VALUES (${Number(nuevo_usuario_id)}, ${today}, 0, ${maxPerDay})
        ON CONFLICT (usuario_id, fecha) DO NOTHING
      `;

      const cupoRows = await tx.$queryRaw<{ total_asignado: number; limite: number }[]>`
        SELECT total_asignado, limite FROM cupo_diario
        WHERE usuario_id = ${Number(nuevo_usuario_id)} AND fecha = ${today}
        FOR UPDATE
      `;

      const cupo = cupoRows[0];
      if (cupo.total_asignado >= cupo.limite) {
        throw new Error("CUPO_AGOTADO");
      }

      // Reasignar (limpiar lote_id para no distorsionar conteos del lote original)
      await tx.oportunidades.update({
        where: { id: Number(id) },
        data: { usuario_id: Number(nuevo_usuario_id), origen: "REASIGNACION", lote_id: null },
      });

      await tx.historial.create({
        data: {
          oportunidad_id: Number(id),
          usuario_id: userId,
          tipo: "REASIGNACION",
          nota: `Reasignado a ${nuevoPromotor.nombre}`,
        },
      });

      // Incrementar cupo atómicamente
      await tx.$executeRaw`
        UPDATE cupo_diario
        SET total_asignado = total_asignado + 1
        WHERE usuario_id = ${Number(nuevo_usuario_id)} AND fecha = ${today}
      `;
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CUPO_AGOTADO") {
      return NextResponse.json(
        { error: `El promotor ${nuevoPromotor.nombre} ha alcanzado su límite diario de asignaciones` },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
