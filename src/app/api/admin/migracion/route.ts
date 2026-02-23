import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

/**
 * POST /api/admin/migracion
 * Endpoint protegido (solo admin) para ejecutar migraciones de datos.
 * Ejecutar una sola vez después del deploy — es idempotente.
 */
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const resultados: string[] = [];

  try {
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
    resultados.push(`Asignado→No contactado pool=true: ${t1} actualizada(s)`);

    // 1b. "Interesado → Descartado": devolver al pool
    const t2 = await prisma.$executeRaw`
      UPDATE embudo_transiciones
      SET devuelve_al_pool = true
      WHERE etapa_origen_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Interesado')
        AND etapa_destino_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Descartado')
        AND devuelve_al_pool = false
    `;
    resultados.push(`Interesado→Descartado pool=true: ${t2} actualizada(s)`);

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
      resultados.push("Asignado→Descartado: creada");
    } else {
      resultados.push("Asignado→Descartado: ya existe, omitida");
    }

    // ============================================================
    // 2. BACKFILL — derivar sucursal_id y region_id de usuarios
    //    desde jerarquía equipo → sucursal → zona → región
    // ============================================================

    // 2a. Actualizar sucursal_id
    const u1 = await prisma.$executeRaw`
      UPDATE usuarios u
      SET sucursal_id = e.sucursal_id
      FROM equipos e
      WHERE u.equipo_id = e.id
        AND e.sucursal_id IS NOT NULL
        AND u.sucursal_id IS DISTINCT FROM e.sucursal_id
    `;
    resultados.push(`Backfill sucursal_id: ${u1} usuario(s) actualizado(s)`);

    // 2b. Actualizar region_id
    const u2 = await prisma.$executeRaw`
      UPDATE usuarios u
      SET region_id = z.region_id
      FROM equipos e
      JOIN sucursales s ON e.sucursal_id = s.id
      JOIN zonas z ON s.zona_id = z.id
      WHERE u.equipo_id = e.id
        AND u.region_id IS DISTINCT FROM z.region_id
    `;
    resultados.push(`Backfill region_id: ${u2} usuario(s) actualizado(s)`);

    // ============================================================
    // 3. VERIFICACIÓN — resumen de usuarios con org completa
    // ============================================================
    const verificacion = await prisma.$queryRaw<{
      total: bigint;
      con_equipo: bigint;
      con_sucursal: bigint;
      con_region: bigint;
      sin_org: bigint;
    }[]>`
      SELECT
        COUNT(*)::bigint as total,
        COUNT(equipo_id)::bigint as con_equipo,
        COUNT(sucursal_id)::bigint as con_sucursal,
        COUNT(region_id)::bigint as con_region,
        COUNT(*) FILTER (WHERE equipo_id IS NOT NULL AND (sucursal_id IS NULL OR region_id IS NULL))::bigint as sin_org
      FROM usuarios
      WHERE activo = true
    `;

    const stats = verificacion[0];

    return NextResponse.json({
      ok: true,
      resultados,
      verificacion: {
        usuarios_activos: Number(stats.total),
        con_equipo: Number(stats.con_equipo),
        con_sucursal: Number(stats.con_sucursal),
        con_region: Number(stats.con_region),
        pendientes_sin_org: Number(stats.sin_org),
      },
    });
  } catch (err) {
    console.error("Error en migración:", err);
    return NextResponse.json(
      { ok: false, resultados, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
