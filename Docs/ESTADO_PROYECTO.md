# Estado del Proyecto — Sistema de Asignación y Gestión Comercial

## Stack Tecnológico
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, MUI v7
- **Backend**: Prisma 5 + PostgreSQL (Railway), NextAuth v4 (JWT, Credentials)
- **Utilidades**: Zod v4, ExcelJS, bcryptjs

## Arquitectura de Bases de Datos

Dos bases de datos separadas en Railway:

| BD | Variable de entorno | Propósito | Acceso |
|----|---------------------|-----------|--------|
| **BD Clientes** | `DATABASE_CLIENTES_URL` | Pool de clientes, catálogos | SOLO LECTURA |
| **BD Sistema** | `DATABASE_SISTEMA_URL` | Toda la operación del sistema | Lectura/Escritura |

Dos Prisma schemas con sus propios clients:
- `prisma/schema.prisma` → BD Sistema → `@prisma/client`
- `prisma/schema-clientes.prisma` → BD Clientes → `src/generated/prisma-clientes`

## Roles del Sistema (5)
| Rol | Área | Descripción |
|-----|------|-------------|
| `admin` | `/admin/*` | Gestión completa del sistema |
| `gerente_regional` | `/admin/*` | Gestión de su región |
| `gerente_sucursal` | `/admin/*` | Gestión de su sucursal |
| `supervisor` | `/admin/*` | Gestión de equipos y promotores |
| `promotor` | `/promotor/*` | Operación diaria de ventas |

## Tablas Principales (BD Sistema)

### Organización
`regiones` → `zonas` → `sucursales` → `equipos` → `usuarios`

### Embudo de Ventas
- `embudo_etapas` — 9 etapas (4 AVANCE + 1 FINAL éxito + 3 SALIDA + 1 FINAL descarte)
- `embudo_transiciones` — 14 transiciones permitidas entre etapas
- `historial` — registro de cada acción/transición
- `ventas` — registro de ventas con num_operacion

### Operación
- `oportunidades` — centro del sistema, une cliente + promotor + embudo
- `datos_contacto` — ediciones de datos de clientes (BD Sistema override de BD Clientes)
- `lotes` — agrupación de asignaciones por fecha
- `captaciones` — clientes capturados por promotores
- `configuracion` — parámetros del sistema (max_registros_por_dia, cooldown_meses, etc.)
- `convenio_reglas` — campos obligatorios por convenio para captaciones
- `planes_trabajo` — convenios permitidos por sucursal

## Flujo del Embudo

```
Asignado (72h) → Contactado (48h) → Interesado (72h) → Negociación (48h) → Venta ✓
    ↓                  ↓                   ↓                   ↓
 No contactado    No interesado      No interesado      Negociación caída
    ↓                  ↓                   ↓                   ↓
  [Auto-pool]       [Auto-pool]        [Auto-pool]         [Auto-pool]
```

**Regla de salidas**: Cuando un promotor marca una oportunidad como salida (No contactado, No interesado, Negociación caída), esta se desactiva automáticamente (`activo=false`) y el cliente regresa al pool. El historial se preserva con la razón de salida.

**Cooldown 3 meses**: Un promotor no puede recibir el mismo cliente que ya trabajó dentro de los últimos 3 meses (configurable via `cooldown_meses` en tabla `configuracion`).

**Timers**: Cada etapa de avance tiene un timer. Si expira, la oportunidad regresa al pool automáticamente (cron job).

## Páginas del Promotor

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/promotor` | Dashboard | Bienvenida, stats, botón solicitar asignación |
| `/promotor/oportunidades` | Mi Asignación | Embudo visual + DataGrid con tabs Asignados/Capturados |
| `/promotor/oportunidades/[id]` | Detalle | Vista completa de una oportunidad con historial |
| `/promotor/asignaciones` | Mis Asignaciones | Lista de lotes con stats y progreso |
| `/promotor/asignaciones/[id]` | Detalle de lote | Grid editable para completar datos (tel, CURP, RFC) |
| `/promotor/captacion` | Captar Cliente | Formulario individual para captar prospectos |

## Páginas Admin

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/admin/embudo` | Embudo | Gestionar etapas y transiciones |
| `/admin/usuarios` | Usuarios | Gestión de usuarios |
| `/admin/organizacion` | Organización | Regiones, zonas, sucursales, equipos |

## APIs Principales

### Oportunidades
- `GET /api/oportunidades` — Lista oportunidades activas del promotor (con merge BD Clientes + datos_contacto)
- `GET /api/oportunidades/[id]` — Detalle con historial y transiciones disponibles
- `POST /api/oportunidades/[id]/transicion` — Ejecutar transición de etapa

### Asignaciones
- `GET /api/asignaciones` — Lista lotes del promotor con stats
- `POST /api/asignaciones` — Solicitar nuevo lote (con filtros cascada y cooldown)
- `GET /api/asignaciones/opciones` — Opciones disponibles para filtros (con cooldown)
- `GET /api/asignaciones/[id]` — Detalle del lote con registros
- `GET /api/asignaciones/[id]/excel` — Descarga Excel del lote

### Captaciones
- `POST /api/captaciones` — Captar un cliente individual
- `POST /api/captaciones/importar` — Importación masiva desde Excel
- `GET /api/captaciones/convenios` — Lista de convenios disponibles
- `GET /api/captaciones/reglas` — Campos obligatorios por convenio

### Embudo
- `GET /api/embudo/etapas` — Estructura del embudo con transiciones

### Otros
- `POST /api/cron/check-timers` — Expirar oportunidades con timer vencido (cron Railway)
- `PATCH /api/clientes/[id]` — Editar datos de contacto de un cliente

## Reglas Clave del Sistema
1. **BD Clientes NUNCA se modifica**. Ediciones van a `datos_contacto` en BD Sistema.
2. **Al leer un cliente**: merge `datos_contacto` encima de datos originales de BD Clientes.
3. **`oportunidades.cliente_id`** referencia `clientes.id` sin FK constraint (DBs separadas).
4. **Query cross-DB**: obtener `cliente_ids` activos de BD Sistema, luego `NOT IN` en BD Clientes.
5. **Captaciones** con `cliente_id=null` almacenan datos en `captaciones.datos_json`.
6. **Salidas auto-pool**: No pasan por supervisor, regresan directo al pool.
7. **Cooldown**: Excluye clientes recientes del mismo promotor al asignar.

## Variables de Entorno
```
DATABASE_SISTEMA_URL=...
DATABASE_CLIENTES_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
CRON_SECRET=...        # Para autenticar el cron job
```

### Tabla `configuracion` (clave-valor)
| Clave | Valor por defecto | Descripción |
|-------|-------------------|-------------|
| `max_registros_por_dia` | 300 | Máximo de registros que un promotor puede solicitar por día |
| `timer_captacion_horas` | 168 | Timer para oportunidades de captación (7 días) |
| `cooldown_meses` | 3 | Meses antes de poder recibir el mismo cliente |

## Scripts npm
```bash
npm run dev               # Desarrollo local
npm run build             # Build de producción
npm run prisma:generate   # Genera ambos Prisma clients
npm run prisma:push       # Aplica schema a BD Sistema
npm run seed:embudo       # Seed de 9 etapas + 14 transiciones
```

## Último Avance (2026-02-18) — Rediseño completo módulo promotor

### Implementado en esta sesión:

#### 1. Control de Horario del Sistema
- Horario operativo: 08:55 AM - 07:15 PM, Lunes a Viernes (America/Mexico_City)
- `src/lib/horario.ts` — validación server-side del horario
- `GET /api/sistema/horario` — endpoint para consultar estado
- Overlay `FueraDeHorario` + `HorarioGuard` en layout promotor
- Hook `useHorario` — polling cada 60s
- APIs protegidas: asignaciones, captaciones, transiciones, importación, exportación
- Configuración via tabla `configuracion` (horario_inicio, horario_fin, dias_operativos)

#### 2. Límite Estricto de Asignación Diaria
- Nueva tabla `cupo_diario` (usuario_id + fecha, unique)
- Validación con `SELECT FOR UPDATE` dentro de transacción Serializable
- Contador decremental: no se reinicia al consumir registros
- `GET /api/asignaciones/cupo` — endpoint para consultar cupo restante
- Prevención de bypass por concurrencia (lock atómico)

#### 3. Autenticación por Username con Bloqueo
- Login cambiado de email a `username` (campo unique en usuarios)
- Bloqueo tras 5 intentos fallidos (15 min)
- Campos nuevos: `username`, `intentos_fallidos`, `bloqueado_hasta`, `debe_cambiar_password`
- Pantalla de cambio de contraseña obligatorio (`/cambiar-password`)
- API `POST /api/auth/cambiar-password`
- Middleware redirige a cambio de contraseña si `debe_cambiar_password = true`
- Admin puede resetear contraseña → fuerza cambio en próximo login

#### 4. Reestructuración UI del Módulo Promotor
- **Sidebar**: 1 solo item (Mi Asignación)
- **Dashboard**: redirect a `/promotor/oportunidades`
- **Mis Lotes**: eliminado del sidebar (no accesible)
- **Captación**: convertida en modal con tabs (Individual + Carga Masiva)
- **6 cards pipeline sin tabs**: Capturados | Asignado | Contactado | Interesado | Negociación | Venta
- Capturados filtra por `origen=CAPTACION`, las demás por etapa (excluyendo captaciones)
- **Filtro default**: card "Asignado" activa al entrar
- **Solicitar Asignación**: botón en la página (no en Dashboard)
- Componentes nuevos: `CaptacionModal`, `SolicitarAsignacionDialog`

#### 5. Control de Descargas
- `POST /api/oportunidades/exportar` — descarga controlada con criterios obligatorios
- Requiere: al menos 1 filtro activo + rango de fechas (máx 90 días)
- Máximo 500 registros por descarga
- Solo registros propios del promotor
- Validación de horario operativo
- Registro de descarga en historial

#### 6. Personalización de Columnas
- Columnas no ocultables: nombre, convenio, teléfono, etapa
- Persistencia de preferencias en localStorage
- Enforcement automático al cambiar visibilidad

### Tabla de configuración actualizada
| Clave | Valor default | Descripción |
|-------|---------------|-------------|
| `max_registros_por_dia` | 300 | Límite diario por promotor |
| `horario_inicio` | 08:55 | Hora de inicio del sistema |
| `horario_fin` | 19:15 | Hora de fin del sistema |
| `dias_operativos` | 1,2,3,4,5 | Días operativos (L-V) |
| `cooldown_meses` | 3 | Meses antes de reasignar mismo cliente |

### Fases Pendientes
- **Fase 3**: Dashboards para gerentes, métricas por sucursal/región
- **Fase 4**: Bandeja supervisor, reasignación de oportunidades, baja de promotor

### Pasos pendientes de despliegue
1. `npx prisma db push` — aplicar nuevos campos (username, cupo_diario, etc.)
2. Script de migración: generar `username` para usuarios existentes
3. `npx prisma db seed` — seed de configuración de horario
4. Agregar `CRON_SECRET` en Railway si no existe

### Archivos clave modificados/creados
```
prisma/schema.prisma                                 — username, cupo_diario, bloqueo
prisma/seed.ts                                       — config de horario + cooldown
src/lib/auth.ts                                      — login por username, bloqueo
src/lib/horario.ts                                   — NUEVO: validación de horario
src/lib/validators.ts                                — username en schemas
src/types/next-auth.d.ts                             — debe_cambiar_password
src/middleware.ts                                    — redirect a cambiar-password
src/hooks/useHorario.ts                              — NUEVO: hook de horario
src/components/FueraDeHorario.tsx                    — NUEVO: overlay fuera de horario
src/components/HorarioGuard.tsx                      — NUEVO: wrapper con overlay
src/components/CaptacionModal.tsx                    — NUEVO: modal unificada
src/components/SolicitarAsignacionDialog.tsx         — NUEVO: dialog de asignación
src/components/ImportCaptacionDialog.tsx             — prop embedded
src/components/layout/Sidebar.tsx                    — 1 item promotor
src/app/login/page.tsx                               — campo username
src/app/cambiar-password/page.tsx                    — NUEVO: cambio de contraseña
src/app/promotor/page.tsx                            — redirect a oportunidades
src/app/promotor/layout.tsx                          — HorarioGuard
src/app/promotor/oportunidades/page.tsx              — 6 cards, sin tabs, modal captación
src/app/api/sistema/horario/route.ts                 — NUEVO: estado del horario
src/app/api/auth/cambiar-password/route.ts           — NUEVO: cambiar contraseña
src/app/api/asignaciones/route.ts                    — cupo_diario + horario
src/app/api/asignaciones/cupo/route.ts               — NUEVO: consultar cupo
src/app/api/oportunidades/exportar/route.ts          — NUEVO: descarga controlada
src/app/api/oportunidades/[id]/transicion/route.ts   — horario
src/app/api/captaciones/route.ts                     — horario
src/app/api/captaciones/importar/route.ts            — horario
src/app/api/admin/usuarios/route.ts                  — username
src/app/api/admin/usuarios/[id]/route.ts             — reset password
```



  AUDITORÍA COMPLETA — Sistema de Asignación y Gestión Comercial                                                                                                                                                                                              
  Archivos revisados: ~150 archivos (.ts/.tsx/.prisma)                                                                         
  Hallazgos totales: 148 (después de deduplicar: ~105 únicos)

  ---
  CRITICAL (18 hallazgos → 12 únicos)

  C1. Rate limiter en memoria — inútil en serverless

  Archivo: src/middleware.ts:13-15
  El loginAttempts Map vive en memoria del proceso. En Railway/serverless cada request puede correr en un isolate diferente. Un
   atacante puede hacer brute-force distribuyendo requests entre instancias. Además el Map nunca se limpia → memory leak bajo  
  ataque.
  Fix: Redis o contador en BD.

  C2. Usuarios desactivados mantienen acceso hasta 24h

  Archivo: src/lib/auth.ts:103-123
  El JWT refresh cada 5 min NO verifica activo ni bloqueado_hasta. Un usuario desactivado por admin sigue operando con su JWT  
  actual (maxAge 24h).
  Fix: Agregar check de activo y bloqueado_hasta en el callback jwt.

  C3. getHoraMexico() produce timestamps incorrectos en BD

  Archivo: src/lib/horario.ts:22-26
  new Date(toLocaleString(...)) crea un Date cuya representación UTC es incorrecta. Los timer_vence guardados en BD están      
  desfasados por el offset server↔Mexico.
  Fix: Usar Intl.DateTimeFormat con parts explícitos, o librería como date-fns-tz.

  C4. Hardcoded UTC-6 rompe durante horario de verano (DST)

  Archivos: src/app/api/busquedas-clientes/route.ts:13-14, cupo/route.ts:16-17
  México cambia a UTC-5 en verano. El offset -06:00 hardcodeado causa que el cupo diario se calcule mal (ventana de "hoy"      
  desplazada 1h).
  Fix: Calcular offset dinámicamente con Intl.DateTimeFormat.

  C5. Cualquier usuario autenticado puede crear asignaciones

  Archivos: src/app/api/asignaciones/route.ts:25,108, todos los endpoints de /api/asignaciones/*
  Usan requireAuth() en vez de requirePromotor() o verificación de rol. Un usuario con rol comercial, direccion o analista     
  puede crear lotes y asignar oportunidades.
  Fix: Cambiar a requirePromotor() o validación de rol explícita.

  C6. QR de WhatsApp se envía a servidor de terceros

  Archivo: src/components/WhatsAppQRDialog.tsx:109
  El token de emparejamiento WhatsApp se envía como query param a api.qrserver.com. Cualquiera con acceso a esos logs puede    
  vincular su dispositivo a la cuenta.
  Fix: Usar librería qrcode local para generar el QR.

  C7. CRON asignar-analistas: NOT IN con array masivo → crash inevitable

  Archivo: src/app/api/cron/asignar-analistas/route.ts:49
  idsExcluidos crece con cada calificación histórica. Con 100k+ IDs, excede el límite de parámetros de PostgreSQL (65535) y    
  crashea.
  Fix: Usar subquery SQL: WHERE id NOT IN (SELECT DISTINCT cliente_id FROM calificaciones_analista UNION ...).

  C8. CRON asignar-analistas: sin transacción → asignaciones duplicadas

  Archivo: src/app/api/cron/asignar-analistas/route.ts:87-119
  Si el CRON se ejecuta 2 veces simultáneamente, ambos leen los mismos clientes IEPPO y los asignan a analistas diferentes. No 
  hay constraint global en cliente_id.
  Fix: Advisory lock o SELECT ... FOR UPDATE en transacción envolvente.

  C9. CRON limpiar-analistas: rescue + delete + update sin transacción

  Archivo: src/app/api/cron/limpiar-analistas/route.ts:31-73
  Si el servidor crashea entre el rescue y el delete, los calificados se duplican en pool_gerente en la siguiente ejecución.   
  Fix: Envolver líneas 35-73 en $transaction.

  C10. Race condition en asignación pool→promotor (supervisor)

  Archivo: src/app/api/supervisor/calificar/pool/asignar/route.ts:48-66
  La verificación asignado: false ocurre FUERA de la transacción. Dos supervisores concurrentes pueden asignar los mismos items
   del pool a promotores diferentes.
  Fix: Mover verificación dentro de transacción con WHERE asignado = false en el updateMany.

  C11. Off-by-one: lote supervisor se finaliza con 1 registro sin calificar

  Archivo: src/app/api/supervisor/calificar/[id]/route.ts:137
  if (pendientes <= 1) debería ser if (pendientes === 0). El update ya se ejecutó en la misma transacción, así que el conteo ya
   refleja el cambio. Resultado: 1 registro queda huérfano permanentemente.
  Fix: Cambiar <= 1 a === 0.

  C12. Race condition en cupo de búsquedas

  Archivo: src/app/api/busquedas-clientes/route.ts:34-41
  El check de cupo y la creación no están en transacción. Dos requests concurrentes pueden ambos pasar el límite.
  Fix: Envolver en transacción con SELECT FOR UPDATE o usar INSERT ... SELECT WHERE count < limit.

  ---
  HIGH (30 hallazgos → 20 únicos)

  H1. JWT refresh usa parseInt(token.id) — pierde precisión con BigInt

  Archivo: src/lib/auth.ts:110
  Incompatible con la migración planificada a BigInt. Usar Number() o planificar para BigInt.

  H2. /api/admin/* no valida rol en middleware

  Archivo: src/middleware.ts:125
  El matcher incluye /api/admin/:path* pero el middleware solo verifica que haya token, no que sea admin. La seguridad depende 
  de que CADA ruta llame requireAdmin().

  H3. Roles comercial/direccion acceden a área promotor

  Archivo: src/middleware.ts:104-111
  El bloque de promotor no tiene return final para roles no contemplados. Roles futuros o existentes como comercial/direccion  
  caen al NextResponse.next().

  H4. pool_gerente y pool_supervisor sin relaciones Prisma a usuarios

  Archivo: prisma/schema.prisma:835-858, 916-935
  Sin referential integrity, sin cascading deletes, sin include para joins.

  H5. Supervisor ve equipo equivocado — usa equipo_id del usuario en vez de equipos.supervisor_id

  Archivos: src/app/api/admin/bandeja/route.ts:16-22, admin/equipo/route.ts:14-18, admin/equipo/oportunidades/route.ts:15-21   

  H6. PUTs de organización sin validación Zod

  Archivos: Todos los [id]/route.ts de equipos, regiones, sucursales, zonas, etapas, transiciones.
  Body se destructura sin validación. Campos arbitrarios pueden llegar a Prisma.

  H7. No hay guard NaN en parseInt(id) de params de ruta

  Archivos: ~20 rutas con [id]. parseInt("abc") → NaN → Prisma error 500.
  Solo baja/route.ts valida correctamente.

  H8. Baja promotor: receptor no validado como activo/mismo-equipo/rol-promotor

  Archivo: src/app/api/admin/usuarios/[id]/baja/route.ts:12-15

  H9. Sin timer_vence en oportunidades creadas desde pool (gerente y supervisor)

  Archivos: src/app/api/gerente/pool-analista/asignar/route.ts:97-108, supervisor/calificar/pool/asignar/route.ts:87-97        
  Oportunidades quedan sin timer → nunca escalan por timeout → se quedan pegadas para siempre.

  H10. REGISTROS_POR_ANALISTA = 300 contradice especificación (100)

  Archivo: src/app/api/cron/asignar-analistas/route.ts:5
  Con 12 analistas, una ejecución consume 3,600 registros — más que los 3,498 disponibles.

  H11. Código muerto en gerente/comparativa: query SQL que nunca se usa

  Archivo: src/app/api/gerente/comparativa/route.ts:29-82
  Raw SQL y agregación calculada pero nunca usada en la respuesta.

  H12. N+1 en gerente/comparativa: 5 queries por sucursal

  Archivo: src/app/api/gerente/comparativa/route.ts:85-125
  10 sucursales = 50+ queries. Debe ser GROUP BY en query única.

  H13. Campaign ownership check fail-open

  Archivo: src/app/api/whatsapp/campanas/[id]/route.ts:14,37
  Si usuario_id no viene en la respuesta del microservicio WA, el check se salta. Cualquier usuario accede.

  H14. Campaign id sin validación → path traversal al microservicio WA

  Archivo: src/app/api/whatsapp/campanas/[id]/route.ts:9
  /campaigns/${id} — un id como ../sessions accede a otros endpoints del microservicio.

  H15. Asistente IA sin rate limiting

  Archivo: src/app/api/asistente/route.ts
  Cada POST incurre timeout de 2 min al backend. Sin throttle, un usuario puede agotar recursos.

  H16. datos_contacto merge sin orderBy en búsquedas

  Archivo: src/app/api/busquedas-clientes/route.ts:109-117
  Sin orden, gana el último registro arbitrario. Otros merges sí usan orderBy: { created_at: "desc" }.

  H17. Cualquier supervisor/gerente/admin puede ver/transicionar CUALQUIER oportunidad

  Archivos: src/app/api/oportunidades/[id]/route.ts:33-36, transicion/route.ts:50-53
  Sin filtro por jerarquía organizacional. Supervisor de región A modifica oportunidades de región B.

  H18. Export aplica take: 501 ANTES de filtros de cliente → export fallido

  Archivo: src/app/api/oportunidades/exportar/route.ts:73-91

  H19. plantillas-whatsapp PUT usa requireAuth() en vez de requirePromotor()

  Archivo: src/app/api/promotor/plantillas-whatsapp/route.ts:27

  H20. ORDER BY id ASC en asignaciones supervisor — selección sesgada, no aleatoria

  Archivos: supervisor/asignaciones/route.ts:229, supervisor/calificar/solicitar/route.ts:123

  ---
  MEDIUM (47 hallazgos → 25 más relevantes)

  ┌─────┬────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────┐  
  │  #  │                            Hallazgo                            │                    Archivo(s)                    │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M1  │ Tabla clientes sin índices (nss, curp, rfc, tel_1, convenio,   │ schema-clientes.prisma                           │  
  │     │ estado) — full table scans                                     │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M2  │ Índice redundante en usuarios.username (ya tiene @unique)      │ schema.prisma:118                                │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M3  │ calcularTimerVence loop infinito si dias_operativos está vacío │ horario.ts:99-135                                │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M4  │ Cache in-memory sin invalidación cross-process (5 min stale)   │ config-cache.ts                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M5  │ telegram_id validado como z.number() pero schema usa BigInt    │ validators.ts:16,28                              │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M6  │ lotes_supervisor sin @@unique([supervisor_id, fecha]) (a       │ schema.prisma:881-895                            │  
  │     │ diferencia de lotes_analista)                                  │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M7  │ setMonth() para cooldown salta días (Mar 31 - 1 mes = Mar 3,   │ asignaciones/route.ts:183-185                    │  
  │     │ no Feb 28)                                                     │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M8  │ Inconsistencia tiene_telefono: opciones cuenta IS NOT NULL,    │ asignaciones/opciones vs asignaciones/route.ts   │  
  │     │ asignaciones filtra TRIM != ''                                 │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M9  │ Dashboard clientesDisponibles puede ser negativo               │ admin/dashboard/route.ts:60                      │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M10 │ Queries sin paginación: bandeja, equipo/oportunidades,         │ Múltiples                                        │  
  │     │ pool_gerente (500 hardcap)                                     │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M11 │ check-timers CRON: loop infinito si update falla               │ cron/check-timers/route.ts:25-93                 │  
  │     │ silenciosamente                                                │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M12 │ sistemaUserId fallback a 1 que puede no existir                │ cron/check-timers/route.ts:18                    │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M13 │ Re-calificación de registros ya calificados permitida          │ analista/calificar/[id]/route.ts                 │  
  │     │ silenciosamente                                                │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M14 │ datos_contacto merge sin allowlist — campo id podría           │ analista/mi-lote/route.ts:61-67                  │  
  │     │ sobreescribir PK                                               │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M15 │ Recalificaciones sin filtro por region_id — cross-region       │ cron/asignar-analistas/route.ts:60-63            │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M16 │ Cache compartido entre supervisores (single-slot overwrite)    │ supervisor/asignaciones/opciones/route.ts:10     │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M17 │ Pool items expirados asignables si UI los tenía seleccionados  │ supervisor/calificar/pool/asignar/route.ts:48-53 │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M18 │ Captaciones POST crea oportunidad con etapa_id: null si no     │ captaciones/route.ts:78-99                       │  
  │     │ existe etapa "Asignado"                                        │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M19 │ Import captaciones: mismo problema, hasta 1000 oportunidades   │ captaciones/importar/route.ts:119-121            │  
  │     │ rotas                                                          │                                                  │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M20 │ Content-Disposition header injection en export                 │ oportunidades/exportar/route.ts:252              │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M21 │ request.json() sin try/catch en asistente POST                 │ asistente/route.ts:15                            │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M22 │ motivo sin límite de longitud en schema ni API                 │ asesor-digital/registros/[id]/route.ts           │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M23 │ Sidebar: gestor_operaciones vs "operaciones" — string frágil   │ Sidebar.tsx:34                                   │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M24 │ onConnected en WhatsAppQRDialog causa re-renders infinitos     │ WhatsAppQRDialog.tsx:77                          │  
  ├─────┼────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤  
  │ M25 │ fecha sin validación de Date válido en asesor-digital          │ asesor-digital/registros/route.ts:73             │  
  └─────┴────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────┘  

  ---
  LOW (53 hallazgos → 20 más relevantes)

  ┌─────┬───────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────┐   
  │  #  │                         Hallazgo                          │                      Archivo(s)                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L1  │ serializeBigInt destruye objetos Date (los convierte en   │ utils.ts:4-16                                        │   
  │     │ {})                                                       │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L2  │ generateExcelBuffer solo exporta 2 columnas (nombre +     │ excel.ts:3-6                                         │   
  │     │ tel)                                                      │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L3  │ waFetch sin timeout — hang indefinido si microservicio    │ wa-service.ts:16-23                                  │   
  │     │ caído                                                     │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L4  │ WA_SERVICE_SECRET default empty string — requests sin     │ wa-service.ts:5-6                                    │   
  │     │ auth silenciosos                                          │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L5  │ formatPhoneForWA no valida longitud final del número      │ whatsapp.ts:15-23                                    │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L6  │ Hooks useHorario/useWhatsAppBeta default optimista —      │ useHorario.ts:31, useWhatsAppBeta.ts:31              │   
  │     │ errores = acceso permitido                                │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L7  │ email field abusado para guardar username en NextAuth     │ auth.ts:79                                           │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L8  │ Response format inconsistente: { ok: true } vs { success: │ Múltiples                                            │   
  │     │  true }                                                   │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L9  │ DELETE planes-trabajo lee id del body en vez de URL       │ admin/planes-trabajo/route.ts:49                     │   
  │     │ params                                                    │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L10 │ No duplicate name check en creación de                    │ admin/organizacion/*                                 │   
  │     │ regiones/zonas/sucursales/equipos                         │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L11 │ Convenio reglas POST retorna 201 incluso en upsert        │ admin/convenio-reglas/route.ts:32                    │   
  │     │ (update)                                                  │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L12 │ Export usuarios carga password_hash en memoria (no lo     │ admin/usuarios/exportar/route.ts:10                  │   
  │     │ exporta, pero lo lee)                                     │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L13 │ Variable ayer calculada pero nunca usada                  │ cron/limpiar-analistas/route.ts:15-17                │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L14 │ SUM() sin COALESCE — Number(null) funciona pero es frágil │ gerente/whatsapp/route.ts:39-48                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L15 │ Loop de creates individuales en vez de createMany         │ gerente/pool-analista/asignar/route.ts:97-108        │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L16 │ WhatsAppIcon SVG duplicado en 2 archivos                  │ promotor/oportunidades/page.tsx,                     │   
  │     │                                                           │ promotor/whatsapp/page.tsx                           │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L17 │ ORIGENES array duplicado en CaptacionModal e              │ Componentes                                          │   
  │     │ ImportCaptacionDialog                                     │                                                      │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L18 │ .xls aceptado en frontend pero rechazado en backend       │ ImportCaptacionDialog.tsx:245                        │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L19 │ Tildes faltantes en UI: "Atras", "codigo", "conexion"     │ Múltiples componentes                                │   
  ├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤   
  │ L20 │ Error boundary expone error.message raw en producción     │ admin/error.tsx:19                                   │   
  └─────┴───────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────┘   

  ---
  FLUJOS POR ROL — Análisis de coherencia

  Promotor ✅ Flujo finito

  Pipeline data-driven por embudo_transiciones. Etapas FINAL y SALIDA desactivan oportunidad (activo=false). No hay ciclos en  
  código, pero un admin podría configurar transiciones circulares en BD (Asignado→Contactado→Asignado). No hay validación      
  anti-ciclo.

  Analista ⚠️ Flujo con riesgo

  CRON 8AM asigna → analista califica → finaliza lote → pool gerente → CRON 12AM limpia. Riesgo: sin transacción en CRON       
  cleanup, registros pueden duplicarse en pool_gerente o quedar huérfanos.

  Supervisor ❌ Bug activo

  Califica lote IEPPO → finaliza → pool → asigna a promotor. Bug C11: lote se finaliza con 1 registro sin calificar
  (off-by-one). Ese registro queda permanentemente inaccesible.

  Gerente ⚠️ Flujo con gaps

  Pool analista → selecciona calificados → asigna a promotor. Gap: oportunidades creadas sin timer_vence (H9) → nunca escalan →
   se quedan pegadas.

  Admin ✅ Funcional con mejoras necesarias

  CRUD completo. Principales issues: falta validación en PUTs (H6), NaN en params (H7), scope de supervisor incorrecto (H5).   

  ---
  TOP 10 FIXES PRIORITARIOS

  ┌───────────┬───────┬────────────────────────────────────────────────────┬───────────────────────────────────────────────┐   
  │ Prioridad │  ID   │                      Impacto                       │                   Esfuerzo                    │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 1         │ C11   │ Lotes se finalizan prematuramente → registros      │ 1 línea                                       │   
  │           │       │ huérfanos                                          │                                               │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 2         │ C5    │ Cualquier usuario puede crear asignaciones         │ 6 archivos, cambiar requireAuth →             │   
  │           │       │                                                    │ requirePromotor                               │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 3         │ C2    │ Usuarios desactivados mantienen acceso 24h         │ 10 líneas en auth.ts                          │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 4         │ C7    │ CRON crashea cuando crecen datos                   │ Refactor a subquery SQL                       │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 5         │ C10   │ Pool items asignados a 2 promotores                │ Mover check dentro de tx                      │   
  │           │       │ simultáneamente                                    │                                               │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 6         │ H9    │ Oportunidades de pool sin timer → pegadas para     │ Agregar cálculo timer_vence                   │   
  │           │       │ siempre                                            │                                               │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 7         │ C6    │ Token WhatsApp expuesto a terceros                 │ Reemplazar con lib qrcode local               │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 8         │ C3/C4 │ Timestamps incorrectos en BD por timezone          │ Refactor getHoraMexico()                      │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 9         │ C8/C9 │ CRONs sin transacciones → datos inconsistentes     │ Envolver en $transaction                      │   
  ├───────────┼───────┼────────────────────────────────────────────────────┼───────────────────────────────────────────────┤   
  │ 10        │ H5    │ Supervisor ve equipo equivocado                    │ Cambiar a equipos.supervisor_id               │   
  └───────────┴───────┴────────────────────────────────────────────────────┴───────────────────────────────────────────────┘   

  ---
  ¿Quieres que empiece a corregir los issues por orden de prioridad? Puedo empezar con el top 10, o si prefieres enfocarte en  
  un área específica, dime.