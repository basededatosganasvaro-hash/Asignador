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
