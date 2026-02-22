-- =============================================
-- 002 - TABLAS RESUMEN DENORMALIZADAS
-- Ejecutar en BD Sistema (Railway)
-- =============================================
-- Fecha: 2026-02-22
-- Descripcion: Tablas resumen que consolidan datos de 3 BDs
--              para consultas rapidas del agente IA.
--              Se populan via sync (POST /sync en backend-ia).
-- =============================================

-- =============================================
-- TABLA: resumen_oportunidades
-- Una fila por oportunidad. Consolida datos de BD Sistema,
-- BD Clientes y BD Capacidades.
-- =============================================

CREATE TABLE IF NOT EXISTS resumen_oportunidades (
  -- === Oportunidad (BD Sistema) ===
  oportunidad_id        INT PRIMARY KEY,
  cliente_id            INT,
  usuario_id            INT NOT NULL,
  etapa_id              INT,
  origen                VARCHAR(20),
  lote_id               INT,
  timer_vence           TIMESTAMP,
  num_operacion         VARCHAR(100),
  venta_validada        BOOLEAN DEFAULT FALSE,
  activo                BOOLEAN DEFAULT TRUE,
  oportunidad_created   TIMESTAMP,
  oportunidad_updated   TIMESTAMP,

  -- === Etapa del embudo (BD Sistema) ===
  etapa_nombre          VARCHAR(100),
  etapa_tipo            VARCHAR(20),
  etapa_orden           INT,
  etapa_color           VARCHAR(7),

  -- === Usuario / Promotor (BD Sistema) ===
  usuario_nombre        VARCHAR(200),
  usuario_username      VARCHAR(50),
  usuario_rol           VARCHAR(30),
  equipo_id             INT,
  equipo_nombre         VARCHAR(200),

  -- === Jerarquia organizacional (BD Sistema) ===
  sucursal_id           INT,
  sucursal_nombre       VARCHAR(200),
  zona_id               INT,
  zona_nombre           VARCHAR(200),
  region_id             INT,
  region_nombre         VARCHAR(200),

  -- === Cliente (BD Clientes - 23 campos clave) ===
  cliente_nss           VARCHAR(255),
  cliente_nombres       VARCHAR(255),
  cliente_a_paterno     VARCHAR(255),
  cliente_a_materno     VARCHAR(255),
  cliente_curp          VARCHAR(255),
  cliente_rfc           VARCHAR(255),
  cliente_edad          VARCHAR(255),
  cliente_genero        VARCHAR(255),
  cliente_estado        VARCHAR(255),
  cliente_municipio     VARCHAR(255),
  cliente_cp            VARCHAR(255),
  cliente_convenio      VARCHAR(255),
  cliente_tipo_cliente  VARCHAR(100),
  cliente_tipo_pension  VARCHAR(255),
  cliente_capacidad     VARCHAR(255),
  cliente_oferta        VARCHAR(255),
  cliente_plazo_oferta  VARCHAR(255),
  cliente_tasa          VARCHAR(255),
  cliente_financiera    VARCHAR(255),
  cliente_dependencia   VARCHAR(255),
  cliente_estatus       VARCHAR(255),
  cliente_monto         VARCHAR(255),
  cliente_monto_comisionable VARCHAR(255),

  -- === Contacto efectivo (merge datos_contacto sobre cliente) ===
  telefono_efectivo     VARCHAR(255),
  email_efectivo        VARCHAR(255),

  -- === Historial agregado (BD Sistema) ===
  total_interacciones   INT DEFAULT 0,
  total_llamadas        INT DEFAULT 0,
  total_whatsapp        INT DEFAULT 0,
  total_sms             INT DEFAULT 0,
  total_notas           INT DEFAULT 0,
  total_cambios_etapa   INT DEFAULT 0,
  ultima_interaccion    TIMESTAMP,

  -- === Venta (BD Sistema) ===
  venta_monto           DECIMAL(12,2),
  venta_fecha           TIMESTAMP,

  -- === Captacion (BD Sistema) ===
  captacion_origen      VARCHAR(50),
  captacion_convenio    VARCHAR(300),
  captacion_fecha       TIMESTAMP,

  -- === Campos computados ===
  timer_vencido         BOOLEAN DEFAULT FALSE,
  dias_sin_interaccion  INT,

  -- === Metadata sync ===
  sync_at               TIMESTAMP DEFAULT NOW()
);

-- Indices para resumen_oportunidades
CREATE INDEX IF NOT EXISTS idx_ro_activo ON resumen_oportunidades (activo);
CREATE INDEX IF NOT EXISTS idx_ro_usuario_activo ON resumen_oportunidades (usuario_id, activo);
CREATE INDEX IF NOT EXISTS idx_ro_usuario_etapa ON resumen_oportunidades (usuario_id, etapa_id, activo);
CREATE INDEX IF NOT EXISTS idx_ro_etapa_activo ON resumen_oportunidades (etapa_id, activo);
CREATE INDEX IF NOT EXISTS idx_ro_sucursal ON resumen_oportunidades (sucursal_id, activo);
CREATE INDEX IF NOT EXISTS idx_ro_zona ON resumen_oportunidades (zona_id, activo);
CREATE INDEX IF NOT EXISTS idx_ro_region ON resumen_oportunidades (region_id, activo);
CREATE INDEX IF NOT EXISTS idx_ro_convenio ON resumen_oportunidades (cliente_convenio);
CREATE INDEX IF NOT EXISTS idx_ro_estado ON resumen_oportunidades (cliente_estado);
CREATE INDEX IF NOT EXISTS idx_ro_timer_vencido ON resumen_oportunidades (timer_vencido, activo) WHERE timer_vencido = TRUE;
CREATE INDEX IF NOT EXISTS idx_ro_origen ON resumen_oportunidades (origen, activo);
CREATE INDEX IF NOT EXISTS idx_ro_created ON resumen_oportunidades (oportunidad_created DESC);


-- =============================================
-- TABLA: resumen_usuarios
-- Una fila por usuario. Consolida metricas y jerarquia.
-- =============================================

CREATE TABLE IF NOT EXISTS resumen_usuarios (
  -- === Usuario (BD Sistema) ===
  usuario_id            INT PRIMARY KEY,
  nombre                VARCHAR(200),
  username              VARCHAR(50),
  rol                   VARCHAR(30),
  telegram_id           BIGINT,
  activo                BOOLEAN DEFAULT TRUE,
  usuario_created       TIMESTAMP,

  -- === Jerarquia organizacional ===
  equipo_id             INT,
  equipo_nombre         VARCHAR(200),
  sucursal_id           INT,
  sucursal_nombre       VARCHAR(200),
  zona_id               INT,
  zona_nombre           VARCHAR(200),
  region_id             INT,
  region_nombre         VARCHAR(200),

  -- === Oportunidades por etapa (conteos) ===
  oportunidades_total   INT DEFAULT 0,
  oportunidades_activas INT DEFAULT 0,
  oportunidades_pool    INT DEFAULT 0,
  oportunidades_captacion INT DEFAULT 0,
  -- Conteos dinamicos por etapa_id
  oportunidades_etapa_1 INT DEFAULT 0,
  oportunidades_etapa_2 INT DEFAULT 0,
  oportunidades_etapa_3 INT DEFAULT 0,
  oportunidades_etapa_4 INT DEFAULT 0,
  oportunidades_etapa_5 INT DEFAULT 0,
  oportunidades_etapa_6 INT DEFAULT 0,
  oportunidades_etapa_7 INT DEFAULT 0,
  oportunidades_etapa_8 INT DEFAULT 0,

  -- === Ventas ===
  ventas_total          INT DEFAULT 0,
  ventas_validadas      INT DEFAULT 0,
  ventas_monto_total    DECIMAL(14,2) DEFAULT 0,
  ventas_monto_validado DECIMAL(14,2) DEFAULT 0,

  -- === Tasas de conversion ===
  tasa_asignacion_contacto  DECIMAL(5,2) DEFAULT 0,
  tasa_contacto_venta       DECIMAL(5,2) DEFAULT 0,
  tasa_global               DECIMAL(5,2) DEFAULT 0,

  -- === Interacciones ===
  interacciones_hoy     INT DEFAULT 0,
  interacciones_semana  INT DEFAULT 0,
  interacciones_mes     INT DEFAULT 0,
  llamadas_total        INT DEFAULT 0,
  whatsapp_total        INT DEFAULT 0,

  -- === Captaciones ===
  captaciones_total     INT DEFAULT 0,
  captaciones_cambaceo  INT DEFAULT 0,
  captaciones_referido  INT DEFAULT 0,
  captaciones_redes     INT DEFAULT 0,

  -- === BD Capacidades (solicitudes IMSS) ===
  solicitudes_imss_total      INT DEFAULT 0,
  solicitudes_imss_pendientes INT DEFAULT 0,
  solicitudes_imss_resueltas  INT DEFAULT 0,

  -- === Cupo diario ===
  cupo_hoy_asignado     INT DEFAULT 0,
  cupo_hoy_limite       INT DEFAULT 300,

  -- === Metadata sync ===
  sync_at               TIMESTAMP DEFAULT NOW()
);

-- Indices para resumen_usuarios
CREATE INDEX IF NOT EXISTS idx_ru_rol ON resumen_usuarios (rol);
CREATE INDEX IF NOT EXISTS idx_ru_sucursal ON resumen_usuarios (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ru_zona ON resumen_usuarios (zona_id);
CREATE INDEX IF NOT EXISTS idx_ru_region ON resumen_usuarios (region_id);
CREATE INDEX IF NOT EXISTS idx_ru_activo ON resumen_usuarios (activo, rol);
CREATE INDEX IF NOT EXISTS idx_ru_ventas ON resumen_usuarios (ventas_total DESC);
