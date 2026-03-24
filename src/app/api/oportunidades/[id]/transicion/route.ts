import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { verificarHorarioConConfig, calcularTimerVenceConConfig } from "@/lib/horario";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  // Validar horario operativo
  const horario = await verificarHorarioConConfig();
  if (!horario.activo) {
    return NextResponse.json({ error: horario.mensaje }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(session!.user.id);
  const rol = session!.user.rol;
  const body = await req.json();
  const { transicion_id, nota, canal, num_operacion, monto } = body;

  if (!transicion_id) {
    return NextResponse.json({ error: "transicion_id es requerido" }, { status: 400 });
  }

  // Validar monto si se envía
  if (monto != null) {
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      return NextResponse.json({ error: "El monto debe ser un número positivo" }, { status: 400 });
    }
  }

  // Limitar longitud de nota
  if (nota && typeof nota === "string" && nota.length > 500) {
    return NextResponse.json({ error: "La nota no puede exceder 500 caracteres" }, { status: 400 });
  }

  // Cargar oportunidad (incluir region del promotor para posible recalificación)
  const op = await prisma.oportunidades.findUnique({
    where: { id: Number(id) },
    include: { etapa: true, usuario: { select: { region_id: true } } },
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

  // Validar num_operacion no duplicado
  if (esVenta && num_operacion) {
    const ventaExistente = await prisma.ventas.findFirst({
      where: { num_operacion: num_operacion.trim() },
      select: { id: true, oportunidad_id: true },
    });
    if (ventaExistente) {
      return NextResponse.json(
        { error: `El numero de operacion "${num_operacion}" ya fue registrado en otra venta` },
        { status: 409 }
      );
    }
  }

  // Salidas/finales no-Venta van a bandeja del supervisor (activo=true, sin timer)
  // Excepto si devuelve_al_pool=true (regresa directo al pool sin pasar por bandeja)
  const enviarABandeja =
    !transicion.devuelve_al_pool &&
    ((transicion.etapa_destino?.tipo === "SALIDA") ||
     (transicion.etapa_destino?.tipo === "FINAL" && transicion.etapa_destino?.nombre !== "Venta"));

  // Calcular nuevo timer_vence (no aplicar timer a items de bandeja ni a capacidades)
  let timerVence: Date | null = null;
  const esCapacidad = op.origen === "CAPACIDADES";
  if (!enviarABandeja && !esCapacidad && transicion.etapa_destino?.timer_dias) {
    timerVence = await calcularTimerVenceConConfig(transicion.etapa_destino.timer_dias);
  }

  // Ejecutar en transacción con verificación de etapa actual (evita doble-transición)
  try {
    const [opActualizada] = await prisma.$transaction(async (tx) => {
      // Re-verificar etapa actual dentro de la transacción (optimistic lock)
      const opActual = await tx.oportunidades.findUnique({
        where: { id: Number(id) },
        select: { etapa_id: true, activo: true },
      });
      if (!opActual || !opActual.activo || opActual.etapa_id !== op.etapa_id) {
        throw new Error("ETAPA_CAMBIADA");
      }

      const deactivate = transicion.devuelve_al_pool;
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
          // Siempre registrar la etapa destino real en historial (para auditoría)
          etapa_nueva_id: transicion.etapa_destino_id,
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
            monto: monto ? parseFloat(String(monto)) : null,
            validada: false,
          },
        });
      }

      // Si la oportunidad vino del pool de analistas y se devuelve al pool → marcar para recalificación
      if (deactivate && op.origen === "POOL" && op.cliente_id) {
        await tx.recalificaciones_pendientes.upsert({
          where: { cliente_id: op.cliente_id },
          create: {
            cliente_id: op.cliente_id,
            region_id: op.usuario?.region_id ?? null,
            motivo: "DEVUELTO_POOL",
          },
          update: {},
        });
      }

      return [updated];
    });

    return NextResponse.json({
      oportunidad: opActualizada,
      confetti: esVenta,
      devuelta_al_pool: transicion.devuelve_al_pool,
      enviada_a_bandeja: enviarABandeja,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ETAPA_CAMBIADA") {
      return NextResponse.json(
        { error: "La etapa de esta oportunidad cambió. Recarga la página e intenta de nuevo." },
        { status: 409 }
      );
    }
    console.error("Error en transicion:", err instanceof Error ? err.message : "Error desconocido");
    return NextResponse.json(
      { error: "Error al procesar la transición" },
      { status: 500 }
    );
  }
}
