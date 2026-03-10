import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaCapacidades } from "@/lib/prisma-capacidades";

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
    select: { id: true, datos_json: true },
  });

  // 4. Extraer solicitud_ids ya sincronizados (con validación robusta)
  const capPorSolicitudId = new Map<number, { id: number; datos_json: Record<string, unknown> }>();
  for (const cap of captacionesExistentes) {
    if (cap.datos_json && typeof cap.datos_json === "object") {
      const datos = cap.datos_json as Record<string, unknown>;
      const solId = datos.solicitud_id;
      let parsedId: number | null = null;
      if (typeof solId === "number" && !isNaN(solId)) {
        parsedId = solId;
      } else if (typeof solId === "string") {
        const parsed = parseInt(solId, 10);
        if (!isNaN(parsed)) parsedId = parsed;
      }
      if (parsedId !== null) {
        capPorSolicitudId.set(parsedId, { id: cap.id, datos_json: datos });
      }
    }
  }

  // 5. Separar solicitudes nuevas y existentes (para actualizar)
  const nuevas = solicitudes.filter((s) => !capPorSolicitudId.has(s.id));
  const existentes = solicitudes.filter((s) => capPorSolicitudId.has(s.id));

  // Helper para construir datos_json desde una solicitud
  const buildDatosJson = (sol: typeof solicitudes[number]) => ({
    solicitud_id: sol.id,
    nombres: sol.nombre_cliente || "Sin nombre",
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
  });

  // 6a. Actualizar captaciones existentes si los datos cambiaron
  let actualizados = 0;
  const erroresActualizar: number[] = [];

  // Campos a comparar para detectar cambios
  const camposComparar = [
    "nombres", "tel_1", "convenio", "nss", "curp", "rfc",
    "numero_empleado", "imss_capacidad_actual", "imss_num_creditos",
    "imss_telefonos", "respuesta", "imss_creditos_json", "fecha_solicitud",
  ] as const;

  for (const sol of existentes) {
    try {
      const capExistente = capPorSolicitudId.get(sol.id)!;
      const nuevosDatos = buildDatosJson(sol);

      // Comparar si hay cambios
      const hayCambios = camposComparar.some((campo) => {
        const valorViejo = capExistente.datos_json[campo];
        const valorNuevo = nuevosDatos[campo as keyof typeof nuevosDatos];
        // Comparar como strings para manejar tipos mixtos (number vs string, null vs undefined)
        return String(valorViejo ?? "") !== String(valorNuevo ?? "");
      });

      if (hayCambios) {
        await prisma.captaciones.update({
          where: { id: capExistente.id },
          data: {
            convenio: sol.convenio || "IMSS",
            datos_json: nuevosDatos,
          },
        });
        actualizados++;
      }
    } catch (err) {
      console.error(`Error actualizando solicitud ${sol.id}:`, err instanceof Error ? err.message : "Error desconocido");
      erroresActualizar.push(sol.id);
    }
  }

  // 6b. Crear oportunidades para cada solicitud nueva
  let sincronizados = 0;
  const errores: number[] = [];

  if (nuevas.length > 0) {
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

    // Capacidades son permanentes: no llevan timer_vence
    for (const sol of nuevas) {
      try {
        await prisma.$transaction(async (tx) => {
          const op = await tx.oportunidades.create({
            data: {
              cliente_id: null,
              usuario_id: userId,
              etapa_id: etapaAsignado.id,
              origen: "CAPACIDADES",
              timer_vence: null,
              activo: true,
            },
          });

          await tx.captaciones.create({
            data: {
              oportunidad_id: op.id,
              usuario_id: userId,
              origen_captacion: "CAPACIDADES",
              convenio: sol.convenio || "IMSS",
              datos_json: buildDatosJson(sol),
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
  }

  const totalErrores = errores.length + erroresActualizar.length;
  return NextResponse.json({
    sincronizados,
    actualizados,
    ya_existentes: existentes.length - actualizados,
    errores: totalErrores > 0 ? totalErrores : undefined,
  });
}
