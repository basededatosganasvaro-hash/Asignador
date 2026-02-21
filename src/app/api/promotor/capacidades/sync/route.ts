import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaCapacidades } from "@/lib/prisma-capacidades";
import { calcularTimerVenceConConfig } from "@/lib/horario";

export async function POST() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = Number(session!.user.id);

  // 1. Obtener telegram_id del usuario
  const usuario = await prisma.usuarios.findUnique({
    where: { id: userId },
    select: { telegram_id: true },
  });

  if (!usuario?.telegram_id) {
    return NextResponse.json(
      { error: "Sin Telegram vinculado. Contacta al administrador." },
      { status: 400 }
    );
  }

  // 2. Fetch solicitudes respondidas del usuario en BD Capacidades
  let solicitudes;
  try {
    solicitudes = await prismaCapacidades.solicitudes.findMany({
      where: {
        user_id: usuario.telegram_id,
        estado: "respondida",
      },
    });
  } catch (err) {
    console.error("Error al consultar BD Capacidades:", err instanceof Error ? err.message : "Error desconocido");
    return NextResponse.json(
      { error: "No se pudo conectar con el servicio de Capacidades. Intenta más tarde." },
      { status: 503 }
    );
  }

  if (solicitudes.length === 0) {
    return NextResponse.json({ sincronizados: 0, ya_existentes: 0 });
  }

  // 3. Fetch captaciones existentes con origen CAPACIDADES de este usuario
  const captacionesExistentes = await prisma.captaciones.findMany({
    where: {
      usuario_id: userId,
      origen_captacion: "CAPACIDADES",
    },
    select: { datos_json: true },
  });

  // 4. Extraer solicitud_ids ya sincronizados (con validación robusta)
  const idsSincronizados = new Set<number>();
  for (const cap of captacionesExistentes) {
    if (cap.datos_json && typeof cap.datos_json === "object") {
      const datos = cap.datos_json as Record<string, unknown>;
      const solId = datos.solicitud_id;
      if (typeof solId === "number" && !isNaN(solId)) {
        idsSincronizados.add(solId);
      } else if (typeof solId === "string") {
        const parsed = parseInt(solId, 10);
        if (!isNaN(parsed)) {
          idsSincronizados.add(parsed);
        }
      }
    }
  }

  // 5. Filtrar solicitudes NO sincronizadas
  const nuevas = solicitudes.filter((s) => !idsSincronizados.has(s.id));

  if (nuevas.length === 0) {
    return NextResponse.json({
      sincronizados: 0,
      ya_existentes: solicitudes.length,
    });
  }

  // Obtener etapa "Asignado" — requerida para crear oportunidades
  const etapaAsignado = await prisma.embudo_etapas.findFirst({
    where: { nombre: "Asignado", activo: true },
  });

  if (!etapaAsignado) {
    console.error("Etapa 'Asignado' no encontrada o inactiva");
    return NextResponse.json(
      { error: "Configuración del sistema incompleta. Contacta al administrador." },
      { status: 500 }
    );
  }

  // Obtener timer config (con validación)
  const timerConfig = await prisma.configuracion.findUnique({
    where: { clave: "timer_captacion_horas" },
  });
  const timerHorasRaw = timerConfig ? Number(timerConfig.valor) : NaN;
  const timerHoras = !isNaN(timerHorasRaw) && timerHorasRaw > 0 ? timerHorasRaw : 168;

  // 6. Crear oportunidades para cada solicitud nueva
  let sincronizados = 0;
  const errores: number[] = [];

  for (const sol of nuevas) {
    try {
      const timerVence = await calcularTimerVenceConConfig(timerHoras);
      const nombres = sol.nombre_cliente || "Sin nombre";

      await prisma.$transaction(async (tx) => {
        const op = await tx.oportunidades.create({
          data: {
            cliente_id: null,
            usuario_id: userId,
            etapa_id: etapaAsignado.id,
            origen: "CAPACIDADES",
            timer_vence: timerVence,
            activo: true,
          },
        });

        await tx.captaciones.create({
          data: {
            oportunidad_id: op.id,
            usuario_id: userId,
            origen_captacion: "CAPACIDADES",
            convenio: sol.convenio || "IMSS",
            datos_json: {
              solicitud_id: sol.id,
              nombres: nombres,
              tel_1: sol.imss_telefonos || null,
              convenio: sol.convenio || "IMSS",
              nss: sol.nss || null,
              curp: sol.curp || null,
              rfc: sol.rfc || null,
              numero_empleado: sol.numero_empleado || null,
              imss_capacidad_actual: sol.imss_capacidad_actual,
              imss_num_creditos: sol.imss_num_creditos,
              imss_telefonos: sol.imss_telefonos || null,
              respuesta: sol.respuesta || null,
              imss_creditos_json: sol.imss_creditos_json || null,
              fecha_solicitud: sol.fecha_solicitud?.toISOString() || null,
            },
          },
        });

        await tx.historial.create({
          data: {
            oportunidad_id: op.id,
            usuario_id: userId,
            tipo: "CAPTACION",
            etapa_nueva_id: etapaAsignado.id,
            nota: "Sincronizado desde Capacidades IMSS",
          },
        });
      });

      sincronizados++;
    } catch (err) {
      console.error(`Error sincronizando solicitud ${sol.id}:`, err instanceof Error ? err.message : "Error desconocido");
      errores.push(sol.id);
    }
  }

  return NextResponse.json({
    sincronizados,
    ya_existentes: solicitudes.length - nuevas.length,
    errores: errores.length > 0 ? errores.length : undefined,
  });
}
