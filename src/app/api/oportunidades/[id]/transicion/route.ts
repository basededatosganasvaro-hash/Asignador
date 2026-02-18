import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const userId = Number(session!.user.id);
  const rol = session!.user.rol;
  const body = await req.json();
  const { transicion_id, nota, canal, num_operacion } = body;

  if (!transicion_id) {
    return NextResponse.json({ error: "transicion_id es requerido" }, { status: 400 });
  }

  // Cargar oportunidad
  const op = await prisma.oportunidades.findUnique({
    where: { id: Number(id) },
    include: { etapa: true },
  });

  if (!op || !op.activo) {
    return NextResponse.json({ error: "Oportunidad no encontrada o inactiva" }, { status: 404 });
  }

  // Verificar acceso
  const rolesSuperiores = ["admin", "gerente_regional", "gerente_sucursal", "supervisor"];
  if (op.usuario_id !== userId && !rolesSuperiores.includes(rol)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  // Cargar transición
  const transicion = await prisma.embudo_transiciones.findUnique({
    where: { id: Number(transicion_id) },
    include: { etapa_destino: true },
  });

  if (!transicion || !transicion.activo) {
    return NextResponse.json({ error: "Transicion no encontrada" }, { status: 404 });
  }

  // Validar que la transición corresponde a la etapa actual
  if (transicion.etapa_origen_id !== op.etapa_id) {
    return NextResponse.json({ error: "La transicion no corresponde a la etapa actual" }, { status: 400 });
  }

  // Nota es siempre opcional (el campo observaciones en la tabla es libre)

  // Validar supervisor requerido
  if (transicion.requiere_supervisor && !rolesSuperiores.includes(rol)) {
    return NextResponse.json({ error: "Esta transicion requiere rol de supervisor o superior" }, { status: 403 });
  }

  // Validar num_operacion para ventas
  const esVenta = transicion.etapa_destino?.tipo === "FINAL" && transicion.etapa_destino?.nombre === "Venta";
  if (esVenta && !num_operacion?.trim()) {
    return NextResponse.json({ error: "Debes ingresar el numero de operacion para registrar una venta" }, { status: 400 });
  }

  // Salidas auto-regresan al pool (el promotor ya no las ve, pero el historial se preserva)
  const esSalidaAutoPool =
    (transicion.etapa_destino?.tipo === "SALIDA") ||
    (transicion.etapa_destino?.tipo === "FINAL" && transicion.etapa_destino?.nombre !== "Venta");

  // Calcular nuevo timer_vence
  let timerVence: Date | null = null;
  if (transicion.etapa_destino?.timer_horas) {
    timerVence = new Date(Date.now() + transicion.etapa_destino.timer_horas * 60 * 60 * 1000);
  }

  // Ejecutar en transacción
  const [opActualizada] = await prisma.$transaction(async (tx) => {
    const deactivate = transicion.devuelve_al_pool || esSalidaAutoPool;
    const updated = await tx.oportunidades.update({
      where: { id: Number(id) },
      data: {
        etapa_id: deactivate ? null : transicion.etapa_destino_id,
        activo: !deactivate,
        timer_vence: deactivate ? null : timerVence,
        ...(esVenta && num_operacion && { num_operacion }),
        ...(esVenta && { venta_validada: false }),
      },
      include: { etapa: true },
    });

    await tx.historial.create({
      data: {
        oportunidad_id: Number(id),
        usuario_id: userId,
        tipo: canal ? canal : "CAMBIO_ETAPA",
        etapa_anterior_id: op.etapa_id,
        // Para salidas auto-pool: preservar la etapa destino en historial como razón de salida
        etapa_nueva_id: transicion.devuelve_al_pool ? null : transicion.etapa_destino_id,
        canal: canal ?? null,
        nota: nota ?? null,
      },
    });

    if (esVenta && num_operacion) {
      await tx.ventas.create({
        data: {
          oportunidad_id: Number(id),
          usuario_id: userId,
          num_operacion,
          validada: false,
        },
      });
    }

    return [updated];
  });

  return NextResponse.json({
    oportunidad: opActualizada,
    confetti: esVenta,
    devuelta_al_pool: transicion.devuelve_al_pool || esSalidaAutoPool,
  });
}
