/**
 * Next.js Instrumentation — se ejecuta UNA vez al iniciar el servidor.
 * Ideal para migraciones de datos idempotentes que deben correr en cada deploy.
 */
export async function register() {
  // Solo ejecutar en el servidor Node.js (no en edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await runMigrations();
  }
}

async function runMigrations() {
  // Import dinámico para evitar que se cargue en el cliente
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    console.log("[migracion] Iniciando migraciones de datos...");

    // ============================================================
    // 1. TRANSICIONES DEL EMBUDO — flujo híbrido de retorno al pool
    // ============================================================

    // 1a. "Asignado → No contactado": auto-return al pool
    const t1 = await prisma.$executeRaw`
      UPDATE embudo_transiciones
      SET devuelve_al_pool = true
      WHERE etapa_origen_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Asignado')
        AND etapa_destino_id = (SELECT id FROM embudo_etapas WHERE nombre = 'No contactado')
        AND devuelve_al_pool = false
    `;
    if (t1 > 0) console.log(`[migracion] Asignado→No contactado pool=true: ${t1}`);

    // 1b. "Interesado → Descartado": devolver al pool
    const t2 = await prisma.$executeRaw`
      UPDATE embudo_transiciones
      SET devuelve_al_pool = true
      WHERE etapa_origen_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Interesado')
        AND etapa_destino_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Descartado')
        AND devuelve_al_pool = false
    `;
    if (t2 > 0) console.log(`[migracion] Interesado→Descartado pool=true: ${t2}`);

    // 1c. Nueva transición "Asignado → Descartado" (si no existe)
    const existe = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*)::bigint as cnt FROM embudo_transiciones
      WHERE etapa_origen_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Asignado')
        AND etapa_destino_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Descartado')
    `;
    if (Number(existe[0]?.cnt ?? 0) === 0) {
      await prisma.$executeRaw`
        INSERT INTO embudo_transiciones (etapa_origen_id, etapa_destino_id, nombre_accion, requiere_nota, requiere_supervisor, devuelve_al_pool, activo)
        VALUES (
          (SELECT id FROM embudo_etapas WHERE nombre = 'Asignado'),
          (SELECT id FROM embudo_etapas WHERE nombre = 'Descartado'),
          'Descartar cliente',
          true,
          true,
          true,
          true
        )
      `;
      console.log("[migracion] Asignado→Descartado: creada");
    }

    // ============================================================
    // 2. FIX RETROACTIVO — desactivar oportunidades trabadas
    //    en estados de salida con activo=true
    // ============================================================

    const fix1 = await prisma.$executeRaw`
      UPDATE oportunidades o
      SET activo = false, etapa_id = NULL, timer_vence = NULL
      FROM embudo_etapas e
      WHERE o.etapa_id = e.id
        AND e.nombre = 'No contactado'
        AND o.activo = true
    `;
    if (fix1 > 0) console.log(`[migracion] Fix No contactado→pool: ${fix1} oportunidad(es)`);

    const fix2 = await prisma.$executeRaw`
      UPDATE oportunidades o
      SET activo = false, etapa_id = NULL, timer_vence = NULL
      FROM embudo_etapas e
      WHERE o.etapa_id = e.id
        AND e.nombre = 'Descartado'
        AND o.activo = true
    `;
    if (fix2 > 0) console.log(`[migracion] Fix Descartado→pool: ${fix2} oportunidad(es)`);

    // ============================================================
    // 3. BACKFILL — derivar sucursal_id y region_id de usuarios
    // ============================================================

    const u1 = await prisma.$executeRaw`
      UPDATE usuarios u
      SET sucursal_id = e.sucursal_id
      FROM equipos e
      WHERE u.equipo_id = e.id
        AND e.sucursal_id IS NOT NULL
        AND u.sucursal_id IS DISTINCT FROM e.sucursal_id
    `;
    if (u1 > 0) console.log(`[migracion] Backfill sucursal_id: ${u1} usuario(s)`);

    const u2 = await prisma.$executeRaw`
      UPDATE usuarios u
      SET region_id = z.region_id
      FROM equipos e
      JOIN sucursales s ON e.sucursal_id = s.id
      JOIN zonas z ON s.zona_id = z.id
      WHERE u.equipo_id = e.id
        AND u.region_id IS DISTINCT FROM z.region_id
    `;
    if (u2 > 0) console.log(`[migracion] Backfill region_id: ${u2} usuario(s)`);

    console.log("[migracion] Migraciones completadas.");
  } catch (err) {
    // No lanzar error para no impedir el arranque del servidor
    console.error("[migracion] Error (no bloqueante):", err instanceof Error ? err.message : err);
  } finally {
    await prisma.$disconnect();
  }
}
