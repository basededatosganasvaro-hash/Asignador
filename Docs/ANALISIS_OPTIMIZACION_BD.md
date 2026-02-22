# Analisis de Optimizacion de Base de Datos

**Fecha:** 2026-02-22
**Version:** 1.0

---

## 1. Arquitectura Actual

### 1.1 Tres Bases de Datos Separadas

| BD | Variable de entorno | Acceso | Proposito |
|----|-------------------|--------|-----------|
| **Sistema** | `DATABASE_SISTEMA_URL` | Lectura/Escritura | Operacion del sistema: usuarios, oportunidades, historial, ventas, captaciones |
| **Clientes** | `DATABASE_CLIENTES_URL` | Solo lectura | Datos de clientes: 86 campos por cliente, catalogos |
| **Capacidades** | `DATABASE_CAPACIDADES_URL` | Solo lectura | Bot Telegram IMSS: usuarios, solicitudes de capacidad |

Adicionalmente, el agente IA conecta a 3 BDs mas (ventas, cobranza, originacion) que no se incluyen en las tablas resumen.

### 1.2 Problema Principal

El agente IA (LangChain SQL Agent) **no puede hacer JOINs cross-database**. Para responder preguntas como "cuantas oportunidades tiene el promotor X en el estado de Jalisco", necesita:

1. Consultar `usuarios` en BD Sistema para obtener el `usuario_id`
2. Consultar `oportunidades` en BD Sistema filtradas por `usuario_id`
3. Consultar `clientes` en BD Clientes para obtener el estado de cada `cliente_id`
4. Cruzar resultados en memoria

Esto resulta en:
- **Queries multiples** por cada pregunta
- **Latencia alta** (3-5 segundos por pregunta compleja)
- **Errores frecuentes** del agente al intentar JOINs entre bases distintas
- **Tokens desperdiciados** en razonamiento sobre como cruzar datos

### 1.3 Tablas Existentes — BD Sistema

| Tabla | Filas estimadas | Indices existentes |
|-------|----------------|--------------------|
| `regiones` | ~10 | PK |
| `zonas` | ~30 | PK, region_id |
| `sucursales` | ~100 | PK, zona_id |
| `equipos` | ~50 | PK, sucursal_id |
| `usuarios` | ~200 | PK, username, rol |
| `oportunidades` | ~50,000+ | PK, usuario_id+activo, cliente_id+activo, etapa_id, timer_vence+activo, etapa_id+activo, lote_id, origen |
| `historial` | ~200,000+ | PK, oportunidad_id, usuario_id, tipo |
| `ventas` | ~5,000 | PK, oportunidad_id (unique) |
| `captaciones` | ~3,000 | PK, oportunidad_id (unique), usuario_id |
| `cupo_diario` | ~10,000 | PK, usuario_id+fecha (unique), usuario_id, fecha |
| `datos_contacto` | ~5,000 | PK, cliente_id+campo |

---

## 2. Indices Nuevos

### 2.1 Archivo: `prisma/sql/001-indices-optimizacion.sql`

Indices compuestos que complementan los existentes:

| Indice | Tabla | Columnas | Caso de uso |
|--------|-------|----------|-------------|
| `idx_oportunidades_usuario_etapa_activo` | oportunidades | (usuario_id, etapa_id, activo) | Dashboard promotor: conteos por etapa |
| `idx_oportunidades_timer_etapa_activo` | oportunidades | (timer_vence, etapa_id, activo) WHERE timer_vence IS NOT NULL | Deteccion de timers vencidos |
| `idx_oportunidades_cliente_etapa_activo` | oportunidades | (cliente_id, etapa_id, activo) WHERE cliente_id IS NOT NULL | Busqueda de oportunidades por cliente |
| `idx_historial_oportunidad_tipo_fecha` | historial | (oportunidad_id, tipo, created_at DESC) | Timeline de oportunidad |
| `idx_historial_fecha_tipo` | historial | (created_at DESC, tipo) | Reportes por rango de fechas |
| `idx_cupo_diario_usuario_fecha` | cupo_diario | (usuario_id, fecha DESC) | Cupo mas reciente |
| `idx_ventas_usuario_validada` | ventas | (usuario_id, validada) | Reportes de ventas por promotor |
| `idx_captaciones_usuario_origen` | captaciones | (usuario_id, origen_captacion) | Captaciones por tipo |

### 2.2 Indice pendiente en BD Capacidades

| Indice | Tabla | Columnas |
|--------|-------|----------|
| `idx_solicitudes_user_estado` | solicitudes | (user_id, estado) |

> **Nota:** Este indice esta comentado en el SQL porque BD Capacidades es de solo lectura. Coordinar con el equipo del bot de Telegram.

---

## 3. Tablas Resumen

### 3.1 Archivo: `prisma/sql/002-tablas-resumen.sql`

### 3.2 `resumen_oportunidades`

**Proposito:** Una fila por oportunidad con todos los datos necesarios para responder preguntas del agente IA sin necesidad de JOINs cross-database.

**Fuentes de datos:**

| Seccion | Fuente | Columnas |
|---------|--------|----------|
| Oportunidad base | `oportunidades` (BD Sistema) | oportunidad_id, cliente_id, usuario_id, etapa_id, origen, lote_id, timer_vence, num_operacion, venta_validada, activo, created/updated |
| Etapa | `embudo_etapas` (BD Sistema) | etapa_nombre, etapa_tipo, etapa_orden, etapa_color |
| Promotor | `usuarios` (BD Sistema) | usuario_nombre, usuario_username, usuario_rol |
| Equipo | `equipos` (BD Sistema) | equipo_id, equipo_nombre |
| Jerarquia | `sucursales`/`zonas`/`regiones` (BD Sistema) | sucursal_id/nombre, zona_id/nombre, region_id/nombre |
| Cliente | `clientes` (BD Clientes) | 23 campos clave: nss, nombres, apellidos, curp, rfc, edad, genero, estado, municipio, cp, convenio, tipo_cliente, tipo_pension, capacidad, oferta, plazo_oferta, tasa, financiera, dependencia, estatus, monto, monto_comisionable |
| Contacto | `datos_contacto` + `clientes` | telefono_efectivo (override o original), email_efectivo |
| Historial | `historial` agregado (BD Sistema) | total_interacciones, total_llamadas/whatsapp/sms/notas/cambios_etapa, ultima_interaccion |
| Venta | `ventas` (BD Sistema) | venta_monto, venta_fecha |
| Captacion | `captaciones` (BD Sistema) | captacion_origen, captacion_convenio, captacion_fecha |
| Computados | Calculados en sync | timer_vencido, dias_sin_interaccion |

**Total:** ~72 columnas

**Indices (12):**

| Indice | Columnas | Patron de consulta |
|--------|----------|--------------------|
| PK | oportunidad_id | Lookup directo |
| idx_ro_activo | activo | Filtro global |
| idx_ro_usuario_activo | usuario_id, activo | "Oportunidades del promotor X" |
| idx_ro_usuario_etapa | usuario_id, etapa_id, activo | "Oportunidades del promotor X en etapa Y" |
| idx_ro_etapa_activo | etapa_id, activo | "Todas las oportunidades en etapa Y" |
| idx_ro_sucursal | sucursal_id, activo | "Oportunidades de la sucursal X" |
| idx_ro_zona | zona_id, activo | Filtro por zona |
| idx_ro_region | region_id, activo | Filtro por region |
| idx_ro_convenio | cliente_convenio | "Oportunidades del convenio X" |
| idx_ro_estado | cliente_estado | "Oportunidades en Jalisco" |
| idx_ro_timer_vencido | timer_vencido, activo | "Oportunidades con timer vencido" |
| idx_ro_origen | origen, activo | Filtro por origen |
| idx_ro_created | oportunidad_created DESC | Ordenar por fecha |

### 3.3 `resumen_usuarios`

**Proposito:** Una fila por usuario con metricas pre-calculadas para rankings, dashboards y preguntas del agente IA.

**Fuentes de datos:**

| Seccion | Fuente | Columnas |
|---------|--------|----------|
| Usuario base | `usuarios` (BD Sistema) | usuario_id, nombre, username, rol, telegram_id, activo, created |
| Jerarquia | JOINs en BD Sistema | equipo, sucursal, zona, region (id + nombre) |
| Oportunidades | `oportunidades` agregadas | total, activas, pool, captacion, por etapa (1-8) |
| Ventas | `ventas` agregadas | total, validadas, montos |
| Tasas | Calculadas | tasa_global (ventas/oportunidades) |
| Interacciones | `historial` filtrado por periodo | hoy, semana, mes, llamadas, whatsapp |
| Captaciones | `captaciones` por origen | total, cambaceo, referido, redes |
| IMSS | `solicitudes` (BD Capacidades) | total, pendientes, resueltas |
| Cupo | `cupo_diario` hoy | asignado, limite |

**Total:** ~52 columnas

**Indices (6):**

| Indice | Columnas | Patron de consulta |
|--------|----------|--------------------|
| PK | usuario_id | Lookup directo |
| idx_ru_rol | rol | "Todos los promotores" |
| idx_ru_sucursal | sucursal_id | "Usuarios de la sucursal X" |
| idx_ru_zona | zona_id | Filtro por zona |
| idx_ru_region | region_id | Filtro por region |
| idx_ru_activo | activo, rol | "Promotores activos" |
| idx_ru_ventas | ventas_total DESC | Rankings de ventas |

---

## 4. Mecanismo de Sincronizacion

### 4.1 Script: `backend-ia/app/sync/resumen_sync.py`

**Flujo de `resumen_oportunidades`:**

```
1. Conectar a BD Sistema + BD Clientes
2. SELECT oportunidades + JOINs jerarquia (BD Sistema)
3. SELECT historial agregado por oportunidad (BD Sistema)
4. SELECT ventas y captaciones (BD Sistema)
5. SELECT datos_contacto overrides (BD Sistema)
6. Batch-fetch clientes por ID en chunks de 1000 (BD Clientes)
7. Merge en Python (dicts por oportunidad_id / cliente_id)
8. INSERT ... ON CONFLICT DO UPDATE (upsert batch)
9. COMMIT
```

**Flujo de `resumen_usuarios`:**

```
1. Conectar a BD Sistema + BD Capacidades
2. SELECT usuarios + JOINs jerarquia
3. SELECT oportunidades agregadas por usuario y etapa
4. SELECT ventas agregadas por usuario
5. SELECT historial filtrado por periodo (hoy/semana/mes)
6. SELECT captaciones por usuario y origen
7. SELECT cupo_diario de hoy
8. Batch-fetch solicitudes IMSS por telegram_id (BD Capacidades)
9. Calcular tasas de conversion
10. INSERT ... ON CONFLICT DO UPDATE (upsert)
11. COMMIT
```

### 4.2 Endpoint: `POST /sync`

- **Ruta:** `POST /sync`
- **Auth:** Header `X-API-Key`
- **Respuesta:**
```json
{
  "status": "ok",
  "tables": [
    {"table": "resumen_oportunidades", "rows": 50000, "duration_s": 12.3},
    {"table": "resumen_usuarios", "rows": 200, "duration_s": 1.5}
  ],
  "total_duration_s": 13.8
}
```

### 4.3 Frecuencia Recomendada

| Escenario | Frecuencia |
|-----------|-----------|
| Datos operativos (durante horario) | Cada 15-30 minutos via cron/scheduler |
| Datos overnight | Una vez a las 06:00 antes de abrir |
| Manual | Cuando se necesite frescura inmediata |

---

## 5. Ejecucion en Deploy (todo automatico)

Todo se ejecuta automaticamente al hacer push a Railway:

### 5.1 Next.js (script `build` en package.json)

```
prisma:generate → migrate-usernames → prisma db push → seed → next build
```

- `prisma db push` crea las tablas `resumen_oportunidades` y `resumen_usuarios` + todos los indices definidos en el schema
- No se necesita ejecutar SQL manualmente

### 5.2 Backend-IA (lifespan en main.py)

Al arrancar el servicio:
1. Uvicorn inicia y el servidor queda listo para recibir requests
2. 5 segundos despues, se lanza `sync_all()` en background
3. Las tablas resumen se llenan automaticamente
4. Si falla, loguea el error pero el servicio sigue funcionando

### 5.3 Sync manual (opcional)

Si se necesita re-sincronizar sin reiniciar:

```bash
curl -X POST https://TU-BACKEND-IA.railway.app/sync \
  -H "X-API-Key: TU_API_KEY"
```

### 5.4 Verificar datos

```sql
SELECT COUNT(*) FROM resumen_oportunidades;
SELECT COUNT(*) FROM resumen_usuarios;

-- Verificar un registro
SELECT oportunidad_id, usuario_nombre, etapa_nombre, cliente_nombres, cliente_estado
FROM resumen_oportunidades
LIMIT 5;
```

### 5.5 Archivos SQL (referencia)

Los archivos en `prisma/sql/` quedan como **documentacion de referencia**:
- `001-indices-optimizacion.sql` — indices ya incluidos en schema.prisma
- `002-tablas-resumen.sql` — DDL ya incluido en schema.prisma

---

## 6. Cambios en el Agente IA

### 6.1 System Prompt Actualizado

Se agrego documentacion completa de las tablas resumen al system prompt (`backend-ia/app/prompts/system.py`) con:

- Lista de todas las columnas disponibles en cada tabla resumen
- Instruccion explicita de **preferir tablas resumen** para consultas generales
- Indicacion de que solo use tablas fuente para datos no incluidos en resumen

### 6.2 Impacto Esperado

| Metrica | Antes | Despues |
|---------|-------|---------|
| Queries por pregunta | 3-5 (cross-DB) | 1 (tabla resumen) |
| Latencia por pregunta | 3-5 seg | <1 seg |
| Errores de JOIN cross-DB | Frecuentes | Eliminados |
| Tokens de razonamiento | Alto (planificar cross-DB) | Bajo (query directo) |

---

## 7. Archivos Modificados/Creados

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modificado | Modelos `resumen_oportunidades` y `resumen_usuarios` |
| `prisma/sql/001-indices-optimizacion.sql` | Nuevo | 8 indices compuestos para BD Sistema |
| `prisma/sql/002-tablas-resumen.sql` | Nuevo | DDL de 2 tablas resumen + 18 indices |
| `backend-ia/app/sync/__init__.py` | Nuevo | Init modulo sync |
| `backend-ia/app/sync/resumen_sync.py` | Nuevo | Script de sincronizacion multi-DB |
| `backend-ia/app/routes/sync.py` | Nuevo | Endpoint POST /sync |
| `backend-ia/app/main.py` | Modificado | Registro de ruta /sync |
| `backend-ia/app/prompts/system.py` | Modificado | Documentacion tablas resumen en prompt |
| `Docs/ANALISIS_OPTIMIZACION_BD.md` | Nuevo | Este documento |

---

## 8. Recomendaciones Futuras

1. **Scheduler automatico**: Implementar un scheduler (APScheduler o cron de Railway) para ejecutar `POST /sync` cada 15 minutos durante horario operativo.

2. **Sync incremental**: En lugar de sincronizar todas las filas, usar `oportunidades.updated_at > last_sync` para solo procesar cambios recientes.

3. **Monitoreo**: Agregar metricas de duracion y filas procesadas a un dashboard para detectar degradacion.

4. **Tablas resumen adicionales**: Considerar tablas resumen para las BDs de ventas, cobranza y originacion cuando el agente las consulte frecuentemente.

5. **Materialized Views**: Si PostgreSQL es >= 9.3, considerar usar `MATERIALIZED VIEW` con `REFRESH CONCURRENTLY` en lugar de tablas + sync manual.

6. **Indices parciales**: Agregar mas indices parciales (WHERE activo = true) para reducir el tamano del indice en tablas con muchos registros inactivos.
