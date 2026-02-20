# Análisis del Flujo de Asignación — 2026-02-19

## Resumen del Flujo

1. **Promotor** solicita asignación via `SolicitarAsignacionDialog`
2. **API** valida cupo, consulta BD Clientes (read-only), crea `lotes` + `oportunidades`
3. **Promotor** gestiona oportunidades, transiciona por etapas del embudo
4. **Timers** auto-devuelven oportunidades vencidas al pool
5. **Reasignación** permite a supervisores reasignar oportunidades
6. **Captación** flujo alternativo donde el promotor crea la oportunidad desde cero

---

## Bugs Críticos

### 1. Oportunidades INVISIBLES al devolver al pool
**Archivos:** `transicion/route.ts`, `cron/check-timers/route.ts`

Cuando una oportunidad se devuelve al pool (salida o timer vencido):
```typescript
data: { etapa_id: null, activo: false, timer_vence: null }
```
Se marca `activo = false` — esto la hace **invisible** para todos:
- El promotor no la ve (filtra `activo: true`)
- El admin no la ve en bandeja (filtra `activo: true`)
- La asignación futura NO la excluye correctamente (solo excluye `activo: true`)

**Impacto:** Esas oportunidades se PIERDEN del sistema. El cliente nunca podrá ser reasignado.

**Fix sugerido:** Al devolver al pool, hacer `activo = true, usuario_id = null, etapa_id = null` en lugar de `activo = false`. O agregar un campo `en_pool Boolean @default(false)`.

---

### 2. Bandeja del supervisor siempre vacía
**Archivo:** `admin/bandeja/route.ts`

```typescript
where: { activo: true, etapa: { tipo: "SALIDA" } }
```

Pero la transición marca `activo = false` en salidas automáticas. La bandeja nunca mostrará resultados.

**Impacto:** Los supervisores no pueden ver ni gestionar las salidas.

---

### 3. Performance — Carga toda la BD en memoria cada request
**Archivo:** `asignaciones/route.ts`

```typescript
const activas = await prisma.oportunidades.findMany({
  where: { activo: true },
  select: { cliente_id: true },  // ← CARGA TODAS
});
```

Con 50K+ oportunidades activas, cada solicitud de asignación carga todos los IDs en memoria. Con 100 requests concurrentes = ~5MB de datos redundantes.

**Fix sugerido:** Usar subquery SQL directamente:
```sql
SELECT id FROM clientes
WHERE id NOT IN (
  SELECT DISTINCT cliente_id FROM oportunidades WHERE activo = true AND cliente_id IS NOT NULL
)
```

---

### 4. Timer inicia fuera de horario operativo
**Archivo:** `captaciones/route.ts`

```typescript
const timerVence = new Date(Date.now() + timerHoras * 60 * 60 * 1000);
```

Si el promotor captura un cliente a las 19:00 con timer de 24h, el timer corre toda la noche sin que pueda trabajar. El timer debería iniciar al comienzo de la siguiente ventana operativa.

---

## Bugs de Severidad Alta

### 5. Race condition en cupo diario
**Archivo:** `asignaciones/route.ts`

El flujo hace `upsert` del cupo ANTES de obtener el lock `FOR UPDATE`:
```typescript
await tx.cupo_diario.upsert({ ... });  // Sin lock
const cupoRows = await tx.$queryRaw`... FOR UPDATE`;  // Lock después
```

Dos requests simultáneos pueden pasar el check de cupo.

**Fix:** Hacer el `INSERT ... ON CONFLICT DO NOTHING` + `SELECT ... FOR UPDATE` en una sola operación.

---

### 6. SQL construido con concatenación de strings
**Archivo:** `asignaciones/route.ts`

```typescript
const sql = `SELECT id FROM clientes ${where} ORDER BY id ASC LIMIT ${limitParam}`;
await prismaClientes.$queryRawUnsafe(sql, ...params);
```

Usa `$queryRawUnsafe` — los params SÍ están parametrizados pero el `where` se construye como string. Riesgo de injection si se agrega un filtro mal sanitizado.

---

### 7. Venta duplicada falla silenciosamente
**Archivo:** `transicion/route.ts`

`ventas` tiene `oportunidad_id UNIQUE`. Si dos requests crean venta para la misma oportunidad, el segundo falla con constraint error sin retry ni mensaje claro.

---

### 8. Reasignación sin validar cupo ni lote
**Archivo:** `reasignar/route.ts`

- No verifica si el promotor destino tiene cupo disponible
- No actualiza `lote_id` — el lote original queda con conteo incorrecto
- No previene reasignar oportunidades ya finalizadas (Venta, etc.)

---

## Bugs de Severidad Media

### 9. timer_horas sin validación positiva
**Archivos:** `transicion/route.ts`, `asignaciones/route.ts`

Si `timer_horas = 0` o negativo, `timer_vence` es una fecha pasada → la oportunidad expira inmediatamente.

---

### 10. Conteos de filtro no reflejan disponibilidad real
**Archivo:** `asignaciones/opciones/route.ts`

Las queries de `DISTINCT` para los dropdowns no excluyen clientes ya asignados. El promotor ve "50 disponibles con Convenio X" pero al solicitar solo obtiene 30.

---

### 11. N+1 en datos_contacto
**Archivo:** `oportunidades/route.ts`

Carga todos los `datos_contacto` para todos los clientes del promotor como registros individuales.

---

### 12. Doble-click en solicitar asignación
**Archivo:** `SolicitarAsignacionDialog.tsx`

El botón de submit no se deshabilita durante la petición — un doble-click puede generar dos lotes.

**Nota:** El estado `submitting` sí existe y deshabilita el botón. Verificar que funciona correctamente.

---

### 13. Timezone con toLocaleString
**Archivo:** `asignaciones/route.ts`

```typescript
const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
```

Funciona pero es frágil. Mejor usar una librería de timezone.

---

## Riesgos de Integridad de Datos

| Riesgo | Consecuencia |
|--------|-------------|
| Oportunidades devueltas al pool → `activo=false` | Clientes perdidos permanentemente |
| Reasignación no actualiza `lote_id` | Conteos de lotes incorrectos |
| Historial de salidas con `etapa_nueva_id = null` | Auditoría incompleta |
| Cupo diario con race condition | Promotor excede su límite |
| Timer fuera de horario | Oportunidades expiran sin oportunidad de trabajo |

---

## Mejoras de Performance Sugeridas

| Área | Actual | Propuesto | Impacto |
|------|--------|-----------|---------|
| Exclusión cross-DB | Carga 50K IDs en memoria | Subquery SQL | -90% memoria |
| Opciones de filtro | 5 queries paralelas cargando todo | Queries con subquery NOT IN | -80% tiempo |
| datos_contacto | findMany + map en memoria | LEFT JOIN o aggregate | -60% queries |
| Cupo diario | upsert + lock separados | Single INSERT ON CONFLICT + lock | Elimina race condition |

---

## Validaciones Faltantes

- [ ] `timer_horas > 0` al crear/transicionar
- [ ] Cupo del promotor destino en reasignación
- [ ] Prevenir reasignar oportunidades finalizadas
- [ ] Timer no inicia fuera de horario operativo
- [ ] Manejo de venta duplicada (upsert o check previo)
- [ ] Alerting cuando cron de timers falla
- [ ] Refresh de contadores en dialog tras error

---

## Prioridad de Fixes

### P0 — Corregir ahora (datos se pierden)
1. Cambiar lógica de "devolver al pool" para NO marcar `activo=false`
2. Arreglar bandeja de supervisor para mostrar salidas

### P1 — Corregir pronto (performance/race conditions)
3. Subquery SQL para exclusión cross-DB
4. Race condition en cupo diario
5. Validar cupo en reasignación

### P2 — Mejorar (UX/integridad)
6. Timer no inicia fuera de horario
7. Conteos de filtro reflejen disponibilidad real
8. Manejo de venta duplicada
9. Validación de timer_horas positivo
10. Actualizar lote_id en reasignación
Corregir ahora (datos se pierden),Corregir pronto (performance/race conditions),Mejorar (UX/integridad)


 Plan to implement                                                                                         │
│                                                                                                           │
│ Análisis Completo: Integración WhatsApp Masivo con Baileys                                                │
│                                                                                                           │
│ Contexto                                                                                                  │
│                                                                                                           │
│ El sistema cuenta con un microservicio separado (services/whatsapp/) que usa Baileys                      │
│ (@whiskeysockets/baileys v6.7.21) para envío masivo de WhatsApp. La app Next.js se comunica con este      │
│ microservicio via HTTP REST. El análisis cubre: arquitectura, bugs detectados, race conditions, mejoras   │
│ de rendimiento y recomendaciones.                                                                         │
│                                                                                                           │
│ ---                                                                                                       │
│ 1. Arquitectura Actual                                                                                    │
│                                                                                                           │
│ ┌─ Next.js (3000) ──────────────────────┐     HTTP + x-service-secret                                     │
│ │  src/lib/wa-service.ts (cliente HTTP)  │ ──────────────────────────────┐                                │
│ │  src/app/api/whatsapp/* (proxy routes) │                              │                                 │
│ │  src/components/WhatsAppQR*.tsx (UI)   │                              ▼                                 │
│ │  src/components/CampanaCrear*.tsx      │     ┌─ Microservicio (3001) ─────────┐                         │
│ └───────────────────────────────────────┘     │  SessionManager (singleton)     │                         │
│                                               │    └─ Map<userId, SessionInfo>  │                         │
│                                               │  MessageQueue (singleton)       │                         │
│                                               │    └─ Map<userId, QueueItem[]>  │                         │
│                                               │  Interceptor (status tracking)  │                         │
│                                               │  AntiSpam (delays, bursts)      │                         │
│                                               └──────────────┬─────────────────┘                          │
│                                                              │                                            │
│                                                              ▼                                            │
│                                               ┌─ PostgreSQL (Railway) ─────────┐                          │
│                                               │  wa_sesiones (creds encriptados)│                         │
│                                               │  wa_campanas (estado, conteos)  │                         │
│                                               │  wa_mensajes (estado individual)│                         │
│                                               └────────────────────────────────┘                          │
│                                                                                                           │
│ Archivos del microservicio:                                                                               │
│ - services/whatsapp/src/index.ts — Express server                                                         │
│ - services/whatsapp/src/config.ts — Constantes anti-spam, timeouts                                        │
│ - services/whatsapp/src/services/session-manager.ts — Gestión de sockets Baileys                          │
│ - services/whatsapp/src/services/message-queue.ts — Cola de envío por usuario                             │
│ - services/whatsapp/src/services/interceptor.ts — Tracking de delivery/read                               │
│ - services/whatsapp/src/services/crypto.ts — AES-256-GCM para credenciales                                │
│ - services/whatsapp/src/lib/anti-spam.ts — Delays humanizados                                             │
│ - services/whatsapp/src/routes/sessions.ts — CRUD sesiones                                                │
│ - services/whatsapp/src/routes/campaigns.ts — CRUD campañas                                               │
│                                                                                                           │
│ Archivos de la app Next.js:                                                                               │
│ - src/lib/wa-service.ts — Cliente HTTP al microservicio                                                   │
│ - src/lib/whatsapp.ts — Templates por etapa, formateo de teléfono                                         │
│ - src/app/api/whatsapp/sesion/* — Proxy connect/disconnect/estado                                         │
│ - src/app/api/whatsapp/campanas/* — Proxy campañas                                                        │
│ - src/app/api/whatsapp/variaciones/route.ts — Generación IA (OpenAI)                                      │
│ - src/app/api/admin/whatsapp/stats/route.ts — Analytics                                                   │
│ - src/app/api/admin/whatsapp/mensajes/route.ts — Detalle de mensajes                                      │
│ - src/components/WhatsAppQRDialog.tsx — UI de escaneo QR                                                  │
│ - src/components/CampanaCrearDialog.tsx — Wizard 4 pasos                                                  │
│ - src/components/CampanaProgreso.tsx — Progreso en tiempo real                                            │
│                                                                                                           │
│ ---                                                                                                       │
│ 2. Bugs Detectados                                                                                        │
│                                                                                                           │
│ BUG-1: Interceptor se registra múltiples veces (CRÍTICO)                                                  │
│                                                                                                           │
│ Archivo: services/whatsapp/src/services/message-queue.ts:100                                              │
│ // Se llama en CADA campaña, acumulando listeners duplicados                                              │
│ attachInterceptor(userId, sock);                                                                          │
│ Problema: Cada campaña nueva llama attachInterceptor() que hace sock.ev.on("messages.update", ...). Si un │
│  promotor lanza 5 campañas, habrá 5 listeners idénticos procesando cada update. Esto causa:               │
│ - Contadores de entregados/leidos se incrementan N veces                                                  │
│ - N queries a BD por cada status update                                                                   │
│ - Memory leak (listeners nunca se remueven)                                                               │
│                                                                                                           │
│ Fix: Mover attachInterceptor al connect() del SessionManager (una sola vez por socket). Usar un Set para  │
│ tracking de sockets ya interceptados.                                                                     │
│                                                                                                           │
│ BUG-2: Reconexión demasiado restrictiva                                                                   │
│                                                                                                           │
│ Archivo: services/whatsapp/src/services/session-manager.ts:121-123                                        │
│ const shouldReconnect = !noReconnectCodes.includes(statusCode || 0)                                       │
│   && statusCode !== undefined                                                                             │
│   && statusCode >= 500;                                                                                   │
│ Problema: Solo reconecta en errores >= 500. Los errores de red (timeout, DNS, socket reset) tienen        │
│ statusCode = undefined, pero la condición statusCode !== undefined los excluye. El promotor pierde        │
│ conexión permanentemente por un glitch de red.                                                            │
│                                                                                                           │
│ Fix: Reconectar cuando statusCode === undefined (error de red) O statusCode >= 500. Excluir solo los      │
│ noReconnectCodes.                                                                                         │
│                                                                                                           │
│ BUG-3: Contadores de campaña se desincronizarán                                                           │
│                                                                                                           │
│ Archivo: services/whatsapp/src/services/interceptor.ts:43-53                                              │
│ Problema: Los contadores entregados y leidos usan { increment: 1 } pero no verifican si ya se contó. Si   │
│ el mismo mensaje recibe dos ACKs de delivery (posible en Baileys), el contador se incrementa dos veces.   │
│ Además, cuando un mensaje pasa de ENTREGADO a LEIDO, se incrementa leidos pero no se decrementa           │
│ entregados — ambos contadores reflejan cosas distintas así que esto puede ser intencional.                │
│                                                                                                           │
│ Fix: Verificar el estado previo del mensaje antes de incrementar. Solo incrementar si el estado realmente │
│  cambió.                                                                                                  │
│                                                                                                           │
│ BUG-4: Límite diario no cuenta PENDIENTE/ENVIANDO                                                         │
│                                                                                                           │
│ Archivo: services/whatsapp/src/services/message-queue.ts:117-122                                          │
│ const enviadosHoy = await prisma.wa_mensajes.count({                                                      │
│   where: {                                                                                                │
│     campana: { usuario_id: userId },                                                                      │
│     enviado_at: { gte: hoy },                                                                             │
│     estado: { in: ["ENVIADO", "ENTREGADO", "LEIDO"] },                                                    │
│   },                                                                                                      │
│ });                                                                                                       │
│ Problema: Si hay 100 mensajes PENDIENTE de una campaña recién creada, no se cuentan. Un promotor podría   │
│ crear múltiples campañas que sumen >180 mensajes antes de que la primera empiece a enviar.                │
│                                                                                                           │
│ Fix: Contar también mensajes con estado: "PENDIENTE" o "ENVIANDO" del día.                                │
│                                                                                                           │
│ BUG-5: Presencia puede fallar sin detener el envío                                                        │
│                                                                                                           │
│ Archivo: services/whatsapp/src/services/message-queue.ts:178-182                                          │
│ await sock.presenceSubscribe(jid);                                                                        │
│ await sleep(1000);                                                                                        │
│ await sock.sendPresenceUpdate("composing", jid);                                                          │
│ await sleep(typingDelay(msg.mensaje_texto.length));                                                       │
│ await sock.sendPresenceUpdate("paused", jid);                                                             │
│ Problema: presenceSubscribe y sendPresenceUpdate pueden lanzar excepciones (número no existe en WA,       │
│ socket desconectado intermedio), pero están FUERA del try-catch del sendMessage. Si presenceSubscribe     │
│ falla, el mensaje nunca se envía y la campaña queda colgada.                                              │
│                                                                                                           │
│ Fix: Envolver toda la simulación de typing en su propio try-catch. Si falla, continuar con el envío del   │
│ mensaje.                                                                                                  │
│                                                                                                           │
│ BUG-6: QR expira sin notificar al frontend                                                                │
│                                                                                                           │
│ Archivo: services/whatsapp/src/services/session-manager.ts                                                │
│ Problema: El QR de WhatsApp expira cada ~60 segundos. Baileys emite un nuevo QR automáticamente (hasta 5  │
│ veces), pero si todos expiran, el socket se cierra con statusCode = 408 (timedOut). El frontend sigue     │
│ mostrando el último QR expirado hasta que el polling detecta el cambio de estado.                         │
│                                                                                                           │
│ Fix: Agregar un qr_expires_at timestamp al status para que el frontend pueda mostrar un countdown o       │
│ auto-refrescar.                                                                                           │
│                                                                                                           │
│ ---                                                                                                       │
│ 3. Race Conditions                                                                                        │
│                                                                                                           │
│ RACE-1: Creación de campaña concurrente supera límite diario                                              │
│                                                                                                           │
│ Flujo problemático:                                                                                       │
│ 1. Promotor tiene 170/180 enviados hoy                                                                    │
│ 2. Crea campaña A con 20 destinatarios → pasa check (170 < 180)                                           │
│ 3. Crea campaña B con 20 destinatarios → pasa check (170 < 180, A aún no envió)                           │
│ 4. Ambas campañas intentan enviar → total real = 210                                                      │
│                                                                                                           │
│ Fix: Contar mensajes PENDIENTE + ENVIANDO además de ENVIADO al verificar límite. El check ya existente en │
│  el loop (remaining <= 0) maneja el caso pero tarde — mejor prevenir en la creación.                      │
│                                                                                                           │
│ RACE-2: Pause/Resume durante envío                                                                        │
│                                                                                                           │
│ Archivo: services/whatsapp/src/services/message-queue.ts:140-146                                          │
│ const campana = await prisma.wa_campanas.findUnique({...});                                               │
│ if (!campana || !["ENVIANDO", "EN_COLA"].includes(campana.estado)) {                                      │
│   break;                                                                                                  │
│ }                                                                                                         │
│ Problema: Entre el findUnique y el sendMessage, el estado podría cambiar a PAUSADA. El mensaje se envía   │
│ después de que el usuario pidió pausa. Es un gap pequeño pero existe.                                     │
│                                                                                                           │
│ Fix: Aceptable para producción. Documentar que la pausa puede tomar hasta 1 mensaje extra.                │
│                                                                                                           │
│ ---                                                                                                       │
│ 4. Mejoras de Rendimiento                                                                                 │
│                                                                                                           │
│ PERF-1: Batch updates en vez de update individual por mensaje                                             │
│                                                                                                           │
│ Actual: Cada mensaje hace 2-3 updates individuales (estado ENVIANDO, luego ENVIADO, luego incremento de   │
│ campaña).                                                                                                 │
│ Mejora: Acumular y hacer batch update cada N mensajes para los contadores de campaña. El estado           │
│ individual del mensaje sí necesita ser inmediato.                                                         │
│                                                                                                           │
│ PERF-2: Índice faltante en wa_mensajes.enviado_at                                                         │
│                                                                                                           │
│ Archivo: services/whatsapp/schema.prisma                                                                  │
│ Problema: La query de stats y de límite diario filtra por enviado_at >= hoy. Sin índice, hace full scan.  │
│ Fix: Agregar @@index([enviado_at]) al modelo wa_mensajes.                                                 │
│                                                                                                           │
│ PERF-3: Polling del frontend demasiado frecuente                                                          │
│                                                                                                           │
│ - CampanaProgreso.tsx: polls cada 5s → subir a 10s                                                        │
│ - WhatsAppQRDialog.tsx: polls cada 2s → aceptable para QR                                                 │
│                                                                                                           │
│ PERF-4: Query de check estado en cada mensaje del loop                                                    │
│                                                                                                           │
│ Archivo: services/whatsapp/src/services/message-queue.ts:140-143                                          │
│ const campana = await prisma.wa_campanas.findUnique({                                                     │
│   where: { id: campanaId },                                                                               │
│   select: { estado: true },                                                                               │
│ });                                                                                                       │
│ Problema: Se ejecuta en CADA iteración del loop. Con 50 mensajes, son 50 queries solo para verificar que  │
│ no se pausó.                                                                                              │
│ Fix: Verificar cada N mensajes (ej: cada 5) o usar un flag in-memory que se setea desde el endpoint       │
│ pause.                                                                                                    │
│                                                                                                           │
│ ---                                                                                                       │
│ 5. Mejoras de Seguridad                                                                                   │
│                                                                                                           │
│ SEC-1: Encryption key se trata como UTF-8 en lugar de hex                                                 │
│                                                                                                           │
│ Archivo: services/whatsapp/src/services/crypto.ts:13                                                      │
│ return Buffer.from(key.slice(0, 32), "utf-8");                                                            │
│ Problema: Una clave de 32 chars UTF-8 = 32 bytes, pero si la clave tiene caracteres especiales el         │
│ resultado es impredecible. Si se usa hex, 32 chars hex = 16 bytes (insuficiente para AES-256).            │
│ Fix: Documentar claramente que la clave debe ser exactamente 32 caracteres ASCII. O cambiar a hex de 64   │
│ chars.                                                                                                    │
│                                                                                                           │
│ SEC-2: Directorio /tmp para sesiones                                                                      │
│                                                                                                           │
│ Problema: Las credenciales de Baileys se escriben en /tmp/wa-sessions/ sin encriptar (solo la copia en BD │
│  está encriptada). En un container compartido, otro proceso podría leerlas.                               │
│ Fix: Aceptable si el container es dedicado. Agregar chmod 700 al crear el directorio.                     │
│                                                                                                           │
│ ---                                                                                                       │
│ 6. Plan de Cambios                                                                                        │
│                                                                                                           │
│ Fase A: Bugs Críticos (3 archivos del microservicio)                                                      │
│                                                                                                           │
│ A1. services/whatsapp/src/services/session-manager.ts                                                     │
│                                                                                                           │
│ - Mover attachInterceptor al evento connection === "open" (línea 96-106)                                  │
│ - Mantener un Set de userIds ya interceptados para no duplicar                                            │
│ - Fix reconexión: cambiar condición a !noReconnectCodes.includes(statusCode || 0) sin la restricción >=   │
│ 500                                                                                                       │
│ - Agregar qr_generated_at al SessionInfo para tracking de expiración                                      │
│                                                                                                           │
│ A2. services/whatsapp/src/services/message-queue.ts                                                       │
│                                                                                                           │
│ - Remover attachInterceptor(userId, sock) de sendCampaign() (línea 100)                                   │
│ - Envolver simulación de typing (presenceSubscribe + sendPresenceUpdate) en try-catch propio (líneas      │
│ 178-182)                                                                                                  │
│ - Cambiar check de límite diario: incluir estados PENDIENTE y ENVIANDO (línea 121)                        │
│ - Reducir frecuencia de check de estado: cada 5 mensajes en vez de cada 1 (línea 140)                     │
│                                                                                                           │
│ A3. services/whatsapp/src/services/interceptor.ts                                                         │
│                                                                                                           │
│ - Verificar estado previo del mensaje antes de incrementar contadores                                     │
│ - Solo incrementar si el estado realmente cambió (ej: no incrementar entregados si ya era ENTREGADO)      │
│                                                                                                           │
│ Fase B: Schema + Performance (1 archivo)                                                                  │
│                                                                                                           │
│ B1. services/whatsapp/schema.prisma                                                                       │
│                                                                                                           │
│ - Agregar @@index([enviado_at]) a wa_mensajes                                                             │
│                                                                                                           │
│ Fase C: Frontend (1 archivo)                                                                              │
│                                                                                                           │
│ C1. src/components/CampanaProgreso.tsx                                                                    │
│                                                                                                           │
│ - Cambiar intervalo de polling de 5s a 10s                                                                │
│                                                                                                           │
│ ---                                                                                                       │
│ 7. Lo que NO se cambia (funciona correctamente)                                                           │
│                                                                                                           │
│ - Anti-spam engine: Los delays y bursts están bien calibrados                                             │
│ - Crypto: AES-256-GCM es correcto, solo documentar el formato de la key                                   │
│ - Flujo de QR: Funcional, el polling de 2s es necesario para UX                                           │
│ - Variaciones IA: OpenAI integration funciona correctamente                                               │
│ - Admin dashboard: Stats y filtros funcionan bien                                                         │
│ - wa-service.ts: Cliente HTTP simple y correcto                                                           │
│ - Idle timeout: 30 min auto-disconnect está bien implementado                                             │
│                                                                                                           │
│ ---                                                                                                       │
│ 8. Verificación                                                                                           │
│                                                                                                           │
│ 1. Lanzar 2 campañas seguidas → verificar que interceptor no duplique contadores                          │
│ 2. Desconectar red del servidor → verificar reconexión automática                                         │
│ 3. Crear campaña con 190 destinatarios teniendo 170 enviados → verificar que se limite correctamente      │
│ 4. Pausar campaña mid-send → verificar que no envíe más de 1 mensaje extra                                │
│ 5. Enviar a número inexistente → verificar que presenceSubscribe falle gracefully                         │
│ 6. Verificar que EXPLAIN del query de stats use el índice de enviado_at  