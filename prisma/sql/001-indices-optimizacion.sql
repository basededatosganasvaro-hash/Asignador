-- =============================================
-- 001 - INDICES DE OPTIMIZACION
-- Ejecutar manualmente en Railway
-- =============================================
-- Fecha: 2026-02-22
-- Descripcion: Indices compuestos para optimizar queries frecuentes
--              del dashboard promotor, reportes y agente IA.
-- =============================================

-- =============================================
-- BD SISTEMA
-- =============================================

-- Dashboard promotor: filtrar oportunidades activas por usuario y etapa
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_oportunidades_usuario_etapa_activo
  ON oportunidades (usuario_id, etapa_id, activo);

-- Timers vencidos: buscar oportunidades con timer vencido por etapa
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_oportunidades_timer_etapa_activo
  ON oportunidades (timer_vence, etapa_id, activo)
  WHERE timer_vence IS NOT NULL;

-- Busqueda cliente+etapa: agente IA consulta oportunidades de un cliente
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_oportunidades_cliente_etapa_activo
  ON oportunidades (cliente_id, etapa_id, activo)
  WHERE cliente_id IS NOT NULL;

-- Timeline de oportunidad: historial ordenado por fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_historial_oportunidad_tipo_fecha
  ON historial (oportunidad_id, tipo, created_at DESC);

-- Reportes por fecha: historial filtrado por rango de fechas
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_historial_fecha_tipo
  ON historial (created_at DESC, tipo);

-- Cupo reciente: ultimo cupo del usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_cupo_diario_usuario_fecha
  ON cupo_diario (usuario_id, fecha DESC);

-- Ventas por usuario: reportes de ventas
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_ventas_usuario_validada
  ON ventas (usuario_id, validada);

-- Captaciones por usuario y origen
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_captaciones_usuario_origen
  ON captaciones (usuario_id, origen_captacion);

-- =============================================
-- BD CAPACIDADES (ejecutar en BD Capacidades)
-- =============================================

-- Filtros combinados de solicitudes
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS
--   idx_solicitudes_user_estado
--   ON solicitudes (user_id, estado);

-- NOTA: El indice de BD Capacidades esta comentado porque
-- esa BD es de solo lectura desde este sistema.
-- Coordinar con el equipo del bot de Telegram para aplicarlo.
