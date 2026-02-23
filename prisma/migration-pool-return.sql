-- ============================================================
-- MIGRACIÓN: Flujo híbrido de retorno al pool
-- Fecha: 2026-02-23
-- ============================================================
-- Cambios:
-- 1. "No contactado" regresa automáticamente al pool (devuelve_al_pool = true)
-- 2. "Descartado" regresa directamente al pool (devuelve_al_pool = true)
-- 3. Nueva transición: Asignado → Descartado (supervisor, pool)
-- ============================================================

-- Primero verificar los IDs de las etapas
-- SELECT id, nombre FROM embudo_etapas ORDER BY orden;

-- 1. Actualizar "Asignado → No contactado": auto-return al pool
UPDATE embudo_transiciones
SET devuelve_al_pool = true
WHERE etapa_origen_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Asignado')
  AND etapa_destino_id = (SELECT id FROM embudo_etapas WHERE nombre = 'No contactado')
  AND nombre_accion = 'No se logro contactar';

-- 2. Actualizar "Interesado → Descartado": devolver al pool
UPDATE embudo_transiciones
SET devuelve_al_pool = true
WHERE etapa_origen_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Interesado')
  AND etapa_destino_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Descartado')
  AND nombre_accion = 'Descartar cliente';

-- 3. Agregar nueva transición: "Asignado → Descartado"
INSERT INTO embudo_transiciones (etapa_origen_id, etapa_destino_id, nombre_accion, requiere_nota, requiere_supervisor, devuelve_al_pool, activo)
SELECT
  (SELECT id FROM embudo_etapas WHERE nombre = 'Asignado'),
  (SELECT id FROM embudo_etapas WHERE nombre = 'Descartado'),
  'Descartar cliente',
  true,
  true,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM embudo_transiciones
  WHERE etapa_origen_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Asignado')
    AND etapa_destino_id = (SELECT id FROM embudo_etapas WHERE nombre = 'Descartado')
);

-- Verificar cambios
SELECT t.id, eo.nombre as origen, ed.nombre as destino, t.nombre_accion, t.devuelve_al_pool
FROM embudo_transiciones t
JOIN embudo_etapas eo ON t.etapa_origen_id = eo.id
LEFT JOIN embudo_etapas ed ON t.etapa_destino_id = ed.id
WHERE t.devuelve_al_pool = true
ORDER BY t.id;
