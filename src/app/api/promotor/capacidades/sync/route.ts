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
  const solicitudes = await prismaCapacidades.solicitudes.findMany({
    where: {
      user_id: usuario.telegram_id,
      estado: "respondida",
    },
  });

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

  // 4. Extraer solicitud_ids ya sincronizados
  const idsSincronizados = new Set<number>();
  for (const cap of captacionesExistentes) {
    const datos = cap.datos_json as Record<string, unknown>;
    if (datos?.solicitud_id) {
      idsSincronizados.add(Number(datos.solicitud_id));
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

  // Obtener etapa "Asignado"
  const etapaAsignado = await prisma.embudo_etapas.findFirst({
    where: { nombre: "Asignado", activo: true },
  });

  // Obtener timer config
  const timerConfig = await prisma.configuracion.findUnique({
    where: { clave: "timer_captacion_horas" },
  });
  const timerHoras = timerConfig ? Number(timerConfig.valor) : 168;

  // 6. Crear oportunidades para cada solicitud nueva
  let sincronizados = 0;
  for (const sol of nuevas) {
    const timerVence = await calcularTimerVenceConConfig(timerHoras);

    const nombres = sol.nombre_cliente || "Sin nombre";

    await prisma.$transaction(async (tx) => {
      const op = await tx.oportunidades.create({
        data: {
          cliente_id: null,
          usuario_id: userId,
          etapa_id: etapaAsignado?.id ?? null,
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
          etapa_nueva_id: etapaAsignado?.id ?? null,
          nota: "Sincronizado desde Capacidades IMSS",
        },
      });
    });

    sincronizados++;
  }

  return NextResponse.json({
    sincronizados,
    ya_existentes: solicitudes.length - sincronizados,
  });
}
