/**
 * Control de horario operativo del sistema.
 * Valida si el sistema está dentro del horario permitido.
 * Configuración por defecto: 08:55 AM - 07:15 PM, Lunes a Viernes (America/Mexico_City).
 */

const ZONA_HORARIA = "America/Mexico_City";

// Defaults (pueden sobreescribirse con tabla configuracion)
const HORARIO_INICIO_DEFAULT = "08:55";
const HORARIO_FIN_DEFAULT = "19:15";
const DIAS_OPERATIVOS_DEFAULT = [1, 2, 3, 4, 5]; // lun=1 ... vie=5

interface HorarioResult {
  activo: boolean;
  mensaje?: string;
  horaActual?: string;
  horarioInicio?: string;
  horarioFin?: string;
}

function getHoraMexico(): Date {
  const now = new Date();
  const mexicoStr = now.toLocaleString("en-US", { timeZone: ZONA_HORARIA });
  return new Date(mexicoStr);
}

export function verificarHorario(config?: {
  horario_inicio?: string;
  horario_fin?: string;
  dias_operativos?: number[];
}): HorarioResult {
  const inicio = config?.horario_inicio || HORARIO_INICIO_DEFAULT;
  const fin = config?.horario_fin || HORARIO_FIN_DEFAULT;
  const diasPermitidos = config?.dias_operativos || DIAS_OPERATIVOS_DEFAULT;

  const ahora = getHoraMexico();
  const dia = ahora.getDay(); // 0=dom, 6=sab
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();

  const [hInicio, mInicio] = inicio.split(":").map(Number);
  const [hFin, mFin] = fin.split(":").map(Number);
  const minutosInicio = hInicio * 60 + mInicio;
  const minutosFin = hFin * 60 + mFin;

  const horaActual = ahora.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA,
  });

  if (!diasPermitidos.includes(dia)) {
    return {
      activo: false,
      mensaje: "El sistema opera de lunes a viernes.",
      horaActual,
      horarioInicio: inicio,
      horarioFin: fin,
    };
  }

  if (minutos < minutosInicio || minutos > minutosFin) {
    return {
      activo: false,
      mensaje: `El sistema opera de ${inicio} a ${fin}.`,
      horaActual,
      horarioInicio: inicio,
      horarioFin: fin,
    };
  }

  return { activo: true, horaActual, horarioInicio: inicio, horarioFin: fin };
}

/**
 * Calcula timer_vence sumando N horas operativas a partir de ahora.
 * Solo cuenta tiempo dentro del horario (L-V, inicio-fin).
 * Si estamos fuera del horario, empieza a contar desde la próxima ventana.
 */
export function calcularTimerVence(
  horasTimer: number,
  config?: { horario_inicio?: string; horario_fin?: string; dias_operativos?: number[] }
): Date {
  const inicio = config?.horario_inicio || HORARIO_INICIO_DEFAULT;
  const fin = config?.horario_fin || HORARIO_FIN_DEFAULT;
  const diasPermitidos = config?.dias_operativos || DIAS_OPERATIVOS_DEFAULT;

  const [hInicio, mInicio] = inicio.split(":").map(Number);
  const [hFin, mFin] = fin.split(":").map(Number);
  const minutosInicio = hInicio * 60 + mInicio;
  const minutosFin = hFin * 60 + mFin;
  const minutosOperativosPorDia = minutosFin - minutosInicio;

  let minutosRestantes = horasTimer * 60;
  const cursor = getHoraMexico();

  // Avanzar al próximo momento operativo si estamos fuera de horario
  const avanzarAProximaVentana = () => {
    // Si es fin de semana o fuera de días operativos, avanzar al próximo día operativo
    while (!diasPermitidos.includes(cursor.getDay())) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(hInicio, mInicio, 0, 0);
    }
    const minutosActuales = cursor.getHours() * 60 + cursor.getMinutes();
    if (minutosActuales < minutosInicio) {
      cursor.setHours(hInicio, mInicio, 0, 0);
    } else if (minutosActuales >= minutosFin) {
      // Pasar al siguiente día operativo
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(hInicio, mInicio, 0, 0);
      while (!diasPermitidos.includes(cursor.getDay())) {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  };

  avanzarAProximaVentana();

  while (minutosRestantes > 0) {
    const minutosActuales = cursor.getHours() * 60 + cursor.getMinutes();
    const minutosHastaFin = minutosFin - minutosActuales;

    if (minutosRestantes <= minutosHastaFin) {
      cursor.setMinutes(cursor.getMinutes() + minutosRestantes);
      minutosRestantes = 0;
    } else {
      minutosRestantes -= minutosHastaFin;
      // Saltar al siguiente día operativo
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(hInicio, mInicio, 0, 0);
      while (!diasPermitidos.includes(cursor.getDay())) {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  return cursor;
}

/**
 * Versión async que carga config de BD y calcula timer_vence.
 */
export async function calcularTimerVenceConConfig(horasTimer: number): Promise<Date> {
  const { prisma } = await import("@/lib/prisma");

  const configs = await prisma.configuracion.findMany({
    where: {
      clave: { in: ["horario_inicio", "horario_fin", "dias_operativos", "horario_activo"] },
    },
  });

  const configMap: Record<string, string> = {};
  for (const c of configs) configMap[c.clave] = c.valor;

  // Si horario desactivado, usar cálculo simple
  if (configMap.horario_activo === "false") {
    return new Date(Date.now() + horasTimer * 60 * 60 * 1000);
  }

  return calcularTimerVence(horasTimer, {
    horario_inicio: configMap.horario_inicio,
    horario_fin: configMap.horario_fin,
    dias_operativos: configMap.dias_operativos
      ? configMap.dias_operativos.split(",").map(Number)
      : undefined,
  });
}

/**
 * Carga configuración de horario desde la tabla `configuracion` y verifica.
 * Uso en APIs protegidas:
 *   const horario = await verificarHorarioConConfig();
 *   if (!horario.activo) return NextResponse.json({ error: horario.mensaje }, { status: 403 });
 */
export async function verificarHorarioConConfig(): Promise<HorarioResult> {
  // Import dinámico para evitar dependencia circular
  const { prisma } = await import("@/lib/prisma");

  const configs = await prisma.configuracion.findMany({
    where: {
      clave: { in: ["horario_inicio", "horario_fin", "dias_operativos", "horario_activo"] },
    },
  });

  const configMap: Record<string, string> = {};
  for (const c of configs) {
    configMap[c.clave] = c.valor;
  }

  // Si el horario está desactivado desde el admin, permitir acceso siempre
  if (configMap.horario_activo === "false") {
    return { activo: true, horaActual: getHoraMexico().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: ZONA_HORARIA }) };
  }

  return verificarHorario({
    horario_inicio: configMap.horario_inicio,
    horario_fin: configMap.horario_fin,
    dias_operativos: configMap.dias_operativos
      ? configMap.dias_operativos.split(",").map(Number)
      : undefined,
  });
}
