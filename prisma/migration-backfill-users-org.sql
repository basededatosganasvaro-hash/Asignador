-- ============================================================
-- BACKFILL: Derivar sucursal_id y region_id de usuarios
-- desde la jerarquía equipo → sucursal → zona → región
-- Fecha: 2026-02-23
-- ============================================================

-- Primero verificar estado actual (cuántos usuarios tienen equipo pero no sucursal/region)
SELECT
  u.id, u.nombre, u.equipo_id, u.sucursal_id, u.region_id,
  e.nombre as equipo, e.sucursal_id as equipo_sucursal_id,
  s.nombre as sucursal, s.zona_id,
  z.nombre as zona, z.region_id as zona_region_id,
  r.nombre as region
FROM usuarios u
LEFT JOIN equipos e ON u.equipo_id = e.id
LEFT JOIN sucursales s ON e.sucursal_id = s.id
LEFT JOIN zonas z ON s.zona_id = z.id
LEFT JOIN regiones r ON z.region_id = r.id
WHERE u.equipo_id IS NOT NULL
  AND (u.sucursal_id IS NULL OR u.region_id IS NULL)
ORDER BY u.id;

-- Actualizar sucursal_id desde equipo → sucursal
UPDATE usuarios u
SET sucursal_id = e.sucursal_id
FROM equipos e
WHERE u.equipo_id = e.id
  AND e.sucursal_id IS NOT NULL
  AND u.sucursal_id IS DISTINCT FROM e.sucursal_id;

-- Actualizar region_id desde equipo → sucursal → zona → región
UPDATE usuarios u
SET region_id = z.region_id
FROM equipos e
JOIN sucursales s ON e.sucursal_id = s.id
JOIN zonas z ON s.zona_id = z.id
WHERE u.equipo_id = e.id
  AND u.region_id IS DISTINCT FROM z.region_id;

-- Verificar resultado
SELECT
  u.id, u.nombre, u.rol,
  e.nombre as equipo,
  s.nombre as sucursal,
  r.nombre as region
FROM usuarios u
LEFT JOIN equipos e ON u.equipo_id = e.id
LEFT JOIN sucursales s ON u.sucursal_id = s.id
LEFT JOIN regiones r ON u.region_id = r.id
WHERE u.activo = true
ORDER BY r.nombre, s.nombre, e.nombre, u.nombre;
