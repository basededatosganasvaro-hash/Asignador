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

## Último Avance (2026-02-18)

### Implementado en esta sesión:
1. **Salidas auto-pool** — Al marcar No contactado, No interesado, Negociación caída o Descartado, la oportunidad se desactiva automáticamente y el cliente regresa al pool. El historial preserva la razón.
2. **Cooldown 3 meses** — En asignaciones y opciones, se excluyen clientes que el promotor ya trabajó en los últimos N meses.
3. **Tabs Asignados/Capturados** — La página de oportunidades separa por origen con tabs dedicados. Embudo y conteos reflejan el tab activo.
4. **Importación masiva** — Nueva API `POST /api/captaciones/importar` + componente `ImportCaptacionDialog` para subir Excel con prospectos.
5. **Embudo limpio** — Eliminada sección "Salidas" y dropdown "Etapa" redundante. Solo cards de avance + Venta.
6. **num_operacion visible** — Columna condicional al filtrar por Venta + visible en modal detalle.
7. **Visibilidad de columnas** — Toolbar con `GridToolbarColumnsButton` para mostrar/ocultar columnas.
8. **Rediseño Mis Asignaciones** — Stat cards (Total Lotes, Registros, Con Teléfono, Listos para Excel), tipografía mejorada, estilos consistentes.

### Fases Pendientes
- **Fase 3**: Dashboards para gerentes, métricas por sucursal/región
- **Fase 4**: Bandeja supervisor, reasignación de oportunidades, baja de promotor

### Archivos clave modificados
```
src/app/api/oportunidades/[id]/transicion/route.ts  — Auto-pool en salidas
src/app/api/oportunidades/route.ts                   — num_operacion en respuesta
src/app/api/asignaciones/route.ts                    — Cooldown en asignación
src/app/api/asignaciones/opciones/route.ts           — Cooldown en opciones
src/app/api/captaciones/importar/route.ts            — NUEVO: importación masiva
src/app/promotor/oportunidades/page.tsx              — Tabs, embudo limpio, columns
src/app/promotor/asignaciones/page.tsx               — Rediseño completo
src/components/ImportCaptacionDialog.tsx              — NUEVO: dialog de importación
```
