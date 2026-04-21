-- Migración: estados descriptivos para wa_campanas
-- Fecha: 2026-04-21
-- Motivo: reemplazar el único "PAUSADA" por estados por motivo
--         (PAUSADA_MANUAL | ESPERA_VENTANA | LIMITE_DIARIO |
--          SIN_SESION | ERRORES_CONSECUTIVOS | INTERRUMPIDA)
-- Aplicar en Railway contra BD Sistema.

BEGIN;

-- 1) Ampliar columna (VarChar 20 → 30)
ALTER TABLE wa_campanas ALTER COLUMN estado TYPE VARCHAR(30);

-- 2) Normalizar estados existentes:
--    todas las PAUSADA históricas → PAUSADA_MANUAL
--    (no podemos inferir el motivo original; el usuario decide si reanudar)
UPDATE wa_campanas
SET estado = 'PAUSADA_MANUAL'
WHERE estado = 'PAUSADA';

COMMIT;
