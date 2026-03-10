/**
 * Next.js Instrumentation — se ejecuta UNA vez al iniciar el servidor.
 * Sincroniza las etapas y transiciones del embudo desde la definición en código.
 * Si cambias las reglas en este archivo → deploy → la BD se actualiza sola.
 * También inicia el cron interno de check-timers (cada 10 min).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await syncEmbudo();
    startTimerCron();
  }
}

// =============================================
// DEFINICIÓN DEL EMBUDO (fuente de verdad)
// =============================================
const ETAPAS = [
  { nombre: "Asignado",          orden: 1, tipo: "AVANCE", timer_dias: 3,    color: "#1565c0" },
  { nombre: "Contactado",        orden: 2, tipo: "AVANCE", timer_dias: 2,    color: "#2196f3" },
  { nombre: "Interesado",        orden: 3, tipo: "AVANCE", timer_dias: 3,    color: "#4caf50" },
  { nombre: "Negociacion",       orden: 4, tipo: "AVANCE", timer_dias: 2,    color: "#ff9800" },
  { nombre: "Venta",             orden: 5, tipo: "FINAL",  timer_dias: null, color: "#66bb6a" },
  { nombre: "No contactado",     orden: 6, tipo: "SALIDA", timer_dias: null, color: "#ef9a9a" },
  { nombre: "No interesado",     orden: 7, tipo: "SALIDA", timer_dias: null, color: "#ef5350" },
  { nombre: "Negociacion caida", orden: 8, tipo: "SALIDA", timer_dias: null, color: "#b71c1c" },
  { nombre: "Descartado",        orden: 9, tipo: "FINAL",  timer_dias: null, color: "#9e9e9e" },
];

const TRANSICIONES = [
  // Desde Asignado
  { origen: "Asignado",      destino: "Contactado",        accion: "Marcar contactado",      nota: true,  sup: false, pool: false },
  { origen: "Asignado",      destino: "No contactado",     accion: "No se logro contactar",  nota: true,  sup: false, pool: true  },
  { origen: "Asignado",      destino: "Descartado",        accion: "Descartar cliente",      nota: true,  sup: false, pool: true  },
  // Desde Contactado
  { origen: "Contactado",    destino: "Interesado",        accion: "Cliente interesado",     nota: true,  sup: false, pool: false },
  { origen: "Contactado",    destino: "No interesado",     accion: "Cliente no interesado",  nota: true,  sup: false, pool: false },
  // Desde Interesado
  { origen: "Interesado",    destino: "Negociacion",       accion: "Iniciar negociacion",    nota: true,  sup: false, pool: false },
  { origen: "Interesado",    destino: "No interesado",     accion: "Perdio interes",         nota: true,  sup: false, pool: false },
  { origen: "Interesado",    destino: "Descartado",        accion: "Descartar cliente",      nota: true,  sup: false, pool: true  },
  // Desde Negociacion
  { origen: "Negociacion",   destino: "Venta",             accion: "Registrar venta",        nota: true,  sup: false, pool: false },
  { origen: "Negociacion",   destino: "Negociacion caida", accion: "Negociacion fallida",    nota: true,  sup: false, pool: false },
  // Desde No contactado (supervisor)
  { origen: "No contactado",     destino: null,            accion: "Devolver al pool",       nota: false, sup: true,  pool: true  },
  // Desde No interesado (supervisor)
  { origen: "No interesado",     destino: "Interesado",    accion: "Retomar cliente",        nota: true,  sup: true,  pool: false },
  { origen: "No interesado",     destino: null,            accion: "Devolver al pool",       nota: false, sup: true,  pool: true  },
  // Desde Negociacion caida (supervisor)
  { origen: "Negociacion caida", destino: "Interesado",    accion: "Retomar cliente",        nota: true,  sup: true,  pool: false },
  { origen: "Negociacion caida", destino: null,            accion: "Devolver al pool",       nota: false, sup: true,  pool: true  },
];

async function syncEmbudo() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    console.log("[embudo] Sincronizando etapas y transiciones...");

    // 1. Upsert etapas por nombre
    const etapaIds: Record<string, number> = {};
    for (const e of ETAPAS) {
      const existing = await prisma.embudo_etapas.findFirst({ where: { nombre: e.nombre } });
      if (existing) {
        await prisma.embudo_etapas.update({
          where: { id: existing.id },
          data: { orden: e.orden, tipo: e.tipo, timer_dias: e.timer_dias, color: e.color },
        });
        etapaIds[e.nombre] = existing.id;
      } else {
        const created = await prisma.embudo_etapas.create({ data: e });
        etapaIds[e.nombre] = created.id;
        console.log(`[embudo] Etapa creada: ${e.nombre}`);
      }
    }

    // 2. Sincronizar transiciones: borrar todas y recrear
    await prisma.embudo_transiciones.deleteMany({});
    for (const t of TRANSICIONES) {
      await prisma.embudo_transiciones.create({
        data: {
          etapa_origen_id:     etapaIds[t.origen],
          etapa_destino_id:    t.destino ? etapaIds[t.destino] : null,
          nombre_accion:       t.accion,
          requiere_nota:       t.nota,
          requiere_supervisor: t.sup,
          devuelve_al_pool:    t.pool,
        },
      });
    }
    console.log(`[embudo] ${TRANSICIONES.length} transiciones sincronizadas.`);

    // 3. Backfill org de usuarios (equipo → sucursal → zona → región)
    const u1 = await prisma.$executeRaw`
      UPDATE usuarios u SET sucursal_id = e.sucursal_id
      FROM equipos e
      WHERE u.equipo_id = e.id AND e.sucursal_id IS NOT NULL
        AND u.sucursal_id IS DISTINCT FROM e.sucursal_id
    `;
    const u2 = await prisma.$executeRaw`
      UPDATE usuarios u SET region_id = z.region_id
      FROM equipos e JOIN sucursales s ON e.sucursal_id = s.id JOIN zonas z ON s.zona_id = z.id
      WHERE u.equipo_id = e.id AND u.region_id IS DISTINCT FROM z.region_id
    `;
    if (u1 > 0 || u2 > 0) console.log(`[embudo] Backfill org: ${u1} sucursal, ${u2} region`);

    console.log("[embudo] Sincronización completada.");
  } catch (err) {
    console.error("[embudo] Error (no bloqueante):", err instanceof Error ? err.message : err);
  } finally {
    await prisma.$disconnect();
  }
}

// =============================================
// CRON INTERNO: CHECK-TIMERS (cada 10 min)
// =============================================
const TIMER_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const BATCH_SIZE = 200;

function startTimerCron() {
  console.log("[cron] Timer check programado cada 10 minutos.");

  // Primera ejecución tras 60s (dar tiempo a que el servidor arranque)
  setTimeout(() => {
    checkTimers();
    setInterval(checkTimers, TIMER_INTERVAL_MS);
  }, 60_000);
}

async function checkTimers() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const ahora = new Date();

    // System user for historial
    const admin = await prisma.usuarios.findFirst({ where: { rol: "admin" } });
    const sistemaUserId = admin?.id ?? 1;

    let totalPool = 0;
    let totalSupervisor = 0;

    let hasMore = true;
    while (hasMore) {
      const vencidas = await prisma.oportunidades.findMany({
        where: {
          activo: true,
          timer_vence: { lt: ahora },
          origen: { not: "CAPACIDADES" },
        },
        select: { id: true, etapa_id: true, usuario_id: true, etapa: { select: { nombre: true } } },
        take: BATCH_SIZE,
      });

      if (vencidas.length === 0) {
        hasMore = false;
        break;
      }

      const alPool = vencidas.filter((op) => op.etapa?.nombre === "Asignado");
      const alSupervisor = vencidas.filter((op) => op.etapa?.nombre !== "Asignado");

      if (alPool.length > 0) {
        const poolIds = alPool.map((op) => op.id);
        await prisma.$transaction([
          prisma.oportunidades.updateMany({
            where: { id: { in: poolIds } },
            data: { activo: false, etapa_id: null, timer_vence: null },
          }),
          prisma.historial.createMany({
            data: alPool.map((op) => ({
              oportunidad_id: op.id,
              usuario_id: sistemaUserId,
              tipo: "TIMER_VENCIDO",
              etapa_anterior_id: op.etapa_id,
              etapa_nueva_id: null,
              nota: "Timer vencido — oportunidad devuelta al pool automaticamente",
            })),
          }),
        ]);
        totalPool += alPool.length;
      }

      if (alSupervisor.length > 0) {
        const supIds = alSupervisor.map((op) => op.id);
        await prisma.$transaction([
          prisma.oportunidades.updateMany({
            where: { id: { in: supIds } },
            data: { escalada_supervisor: true, timer_vence: null },
          }),
          prisma.historial.createMany({
            data: alSupervisor.map((op) => ({
              oportunidad_id: op.id,
              usuario_id: sistemaUserId,
              tipo: "TIMER_VENCIDO",
              etapa_anterior_id: op.etapa_id,
              etapa_nueva_id: op.etapa_id,
              nota: "Timer vencido — escalada al supervisor para reasignacion",
            })),
          }),
        ]);
        totalSupervisor += alSupervisor.length;
      }

      if (vencidas.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    if (totalPool > 0 || totalSupervisor > 0) {
      console.log(`[cron] Timers procesados: ${totalPool} al pool, ${totalSupervisor} escaladas.`);
    }
  } catch (err) {
    console.error("[cron] Error en check-timers:", err instanceof Error ? err.message : err);
  } finally {
    await prisma.$disconnect();
  }
}
