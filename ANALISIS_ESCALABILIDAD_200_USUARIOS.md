# Análisis de Escalabilidad: 200 Usuarios Concurrentes

## Contexto

El sistema actualmente soporta un volumen bajo de usuarios. El objetivo es identificar y resolver los cuellos de botella para que soporte ~200 usuarios concurrentes (mayoritariamente promotores) sin degradación perceptible. El stack es Next.js 16 + Prisma 5 + PostgreSQL (Railway), con dos bases de datos separadas.

**Premisa**: No se recortan funciones. Se optimiza lo existente para que todo se mueva fluido.

---

## Resumen Ejecutivo de Hallazgos

| # | Problema | Severidad | Impacto estimado a 200 usuarios |
|---|---------|-----------|--------------------------------|
| 1 | Pool de conexiones DB sin configurar (default=10) | CRITICA | Saturación de conexiones, errores 500 |
| 2 | Configuración/horario se consulta en cada request sin cache | ALTA | ~500+ queries/min innecesarias a tabla de 10 filas |
| 3 | `/api/oportunidades` GET — 3 queries secuenciales sin paginación | ALTA | Latencia alta, 600+ queries concurrentes |
| 4 | Transacción Serializable en asignaciones | ALTA | Cola de espera, timeouts bajo contención |
| 5 | `/api/captaciones/importar` — loop secuencial dentro de transacción | MEDIA | Transacciones largas bloquean recursos |
| 6 | `/api/admin/dashboard` — carga ALL promotores con lotes+oportunidades | MEDIA | Response pesado, subqueries O(n) |
| 7 | `/api/cron/check-timers` — update individual por cada oportunidad | MEDIA | Transacciones innecesariamente largas |
| 8 | Índices faltantes en tablas clave | MEDIA | Full table scans en queries frecuentes |
| 9 | `next.config.ts` sin compress ni headers de cache | BAJA | Payloads más grandes de lo necesario |

---

## 1. Pool de Conexiones de Base de Datos

### Estado actual
```typescript
// src/lib/prisma.ts — línea 7
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
```
- Prisma default: **10 conexiones** por client
- 2 clients (Sistema + Clientes) = 20 conexiones totales
- Railway PostgreSQL probablemente permite 50-100 conexiones

### Problema
Con 200 usuarios haciendo requests concurrentes, 10 conexiones se saturan inmediatamente. Los requests quedan en cola esperando conexión libre → timeouts.

### Propuesta
Agregar `connection_limit` en las URLs de conexión y configurar pool en el Prisma client:

**Archivo**: `src/lib/prisma.ts`
```typescript
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_SISTEMA_URL,
    },
  },
});
```
**Archivo**: `.env` — agregar `?connection_limit=30&pool_timeout=15` a ambas URLs

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Conexiones simultáneas | 10 por DB (20 total) | 30 por DB (60 total) |
| Timeout de pool | Default Prisma (10s) | 15 segundos explícito |
| Riesgo | Saturación con >10 requests simultáneos | Soporta ~30 requests simultáneos por DB |

### Riesgos
- Si Railway limita conexiones a <60, hay que verificar el plan. Se puede usar PgBouncer como alternativa.
- Más conexiones = más memoria en el servidor DB.

---

## 2. Cache de Configuración y Horario

### Estado actual
Cada request POST de promotor llama `verificarHorarioConConfig()` que ejecuta:
```typescript
// src/lib/horario.ts — línea 179
const configs = await prisma.configuracion.findMany({
  where: { clave: { in: ["horario_inicio", "horario_fin", "dias_operativos", "horario_activo"] } },
});
```
Además, `POST /api/asignaciones` consulta `configuracion` 2 veces más (líneas 116 y 151).

### Problema
Con 200 promotores activos:
- Cada transición de etapa → 1 query a `configuracion`
- Cada asignación → 3 queries a `configuracion`
- Cada captación → 1 query a `configuracion`
- **Estimado: 300-500 queries/min** a una tabla que cambia tal vez 1 vez al día

### Propuesta
Crear un cache en memoria con TTL de 5 minutos:

**Archivo nuevo**: `src/lib/config-cache.ts`
```typescript
const cache: Map<string, { value: string; expiry: number }> = new Map();
const TTL = 5 * 60 * 1000; // 5 minutos

export async function getConfig(clave: string): Promise<string | null> {
  const cached = cache.get(clave);
  if (cached && Date.now() < cached.expiry) return cached.value;

  const { prisma } = await import("@/lib/prisma");
  const config = await prisma.configuracion.findUnique({ where: { clave } });
  if (config) {
    cache.set(clave, { value: config.valor, expiry: Date.now() + TTL });
  }
  return config?.valor ?? null;
}

export async function getConfigBatch(claves: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const clave of claves) {
    const cached = cache.get(clave);
    if (cached && Date.now() < cached.expiry) {
      result[clave] = cached.value;
    } else {
      missing.push(clave);
    }
  }

  if (missing.length > 0) {
    const { prisma } = await import("@/lib/prisma");
    const configs = await prisma.configuracion.findMany({
      where: { clave: { in: missing } },
    });
    for (const c of configs) {
      cache.set(c.clave, { value: c.valor, expiry: Date.now() + TTL });
      result[c.clave] = c.valor;
    }
  }
  return result;
}

export function invalidateConfig(clave?: string) {
  if (clave) cache.delete(clave);
  else cache.clear();
}
```

**Archivos a modificar**:
- `src/lib/horario.ts` — `verificarHorarioConConfig()` y `calcularTimerVenceConConfig()` usan `getConfigBatch` en vez de `prisma.configuracion.findMany`
- `src/app/api/asignaciones/route.ts` — líneas 116 y 151 usan `getConfig("max_registros_por_dia")` y `getConfig("cooldown_meses")`
- `src/app/api/admin/configuracion/route.ts` — PUT llama `invalidateConfig()` después de guardar

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Queries a configuracion/min | 300-500 | 1-5 (solo misses del cache) |
| Latencia de configuración | 5-15ms (query DB) | <1ms (memoria) |
| Propagación de cambios admin | Inmediata | Hasta 5 min de delay |
| Nuevo archivo | — | `src/lib/config-cache.ts` |

### Riesgos
- **Delay de 5 min**: Si admin cambia horario, promotores siguen viendo el valor anterior hasta 5 min. Aceptable porque estos cambios son infrecuentes.
- La función `invalidateConfig()` solo limpia en el proceso actual. Con múltiples instancias de Next.js (scaling horizontal), cada instancia tendría su propio cache. Para el volumen actual (1 instancia) esto es suficiente.

---

## 3. Optimización de `/api/oportunidades` (GET)

### Estado actual
```
Query 1: prisma.oportunidades.findMany (con 4 includes) — línea 12
Query 2: prismaClientes.clientes.findMany (in: clienteIds) — línea 44
Query 3: prisma.datos_contacto.findMany (in: clienteIds) — línea 53
```
Las 3 queries son **secuenciales**. No hay paginación.

### Problema
- 200 promotores abriendo la pantalla principal = 600 queries simultáneas
- Si un promotor tiene 500 oportunidades, las 3 queries mueven datos innecesarios
- Las queries 2 y 3 son **independientes entre sí** pero se ejecutan en secuencia

### Propuesta
**a) Paralelizar queries 2 y 3** (cambio simple, bajo riesgo):

**Archivo**: `src/app/api/oportunidades/route.ts` — reemplazar líneas 43-63
```typescript
// ANTES: secuencial
const clientes = await prismaClientes.clientes.findMany({...});
// ...
const edits = await prisma.datos_contacto.findMany({...});

// DESPUÉS: paralelo
const [clientesRaw, editsRaw] = await Promise.all([
  clienteIds.length > 0
    ? prismaClientes.clientes.findMany({ where: { id: { in: clienteIds } } })
    : [],
  clienteIds.length > 0
    ? prisma.datos_contacto.findMany({
        where: { cliente_id: { in: clienteIds } },
        orderBy: { created_at: "desc" },
      })
    : [],
]);
```

**b) Agregar `select` explícito a la query de oportunidades** para traer solo los campos necesarios en vez de `include` completo.

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Queries secuenciales | 3 en serie | 1 + 2 en paralelo |
| Tiempo total estimado | 45-90ms | 25-50ms |
| Datos transferidos | Todo el row de clientes | Solo campos necesarios |
| Funcionalidad | Idéntica | Idéntica |

### Riesgos
- Ninguno funcional. `Promise.all` falla si cualquiera falla, mismo comportamiento que antes.
- Mayor pico de uso de conexiones simultáneas (2 queries en paralelo vs 1), pero con el pool ampliado del punto 1 no es problema.

---

## 4. Transacción de Asignaciones — Isolation Level

### Estado actual
```typescript
// src/app/api/asignaciones/route.ts — líneas 283-286
{
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 30000,
}
```
`Serializable` = la transacción más restrictiva. Solo una puede ejecutarse a la vez si acceden a los mismos datos. Con `FOR UPDATE` en cupo_diario (línea 221), ya hay protección de fila.

### Problema
Si 20 promotores piden asignación al mismo tiempo:
- `Serializable` serializa TODAS las transacciones que toquen las mismas tablas
- Los promotores esperan en cola hasta 30s cada uno
- Posibles timeouts y errores 500

### Propuesta
Bajar a `RepeatableRead`. El `FOR UPDATE` en cupo_diario ya garantiza atomicidad del cupo:

**Archivo**: `src/app/api/asignaciones/route.ts` — línea 284
```typescript
// ANTES
isolationLevel: Prisma.TransactionIsolationLevel.Serializable,

// DESPUÉS
isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
```

Además, agregar **retry logic** para el caso de conflicto de serialización:

```typescript
// Wrapper con retry
async function crearAsignacionConRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isSerializationError = err instanceof Error &&
        err.message.includes("could not serialize");
      if (!isSerializationError || i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 100 * (i + 1))); // backoff
    }
  }
  throw new Error("Max retries exceeded");
}
```

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Isolation level | Serializable | RepeatableRead |
| Contención entre promotores | Alta (cola secuencial) | Baja (solo compiten por row de cupo) |
| Protección de cupo | FOR UPDATE + Serializable | FOR UPDATE (suficiente) |
| Manejo de conflictos | Error 500 directo | Retry automático (hasta 3 veces) |
| Timeouts estimados | Frecuentes con >10 concurrentes | Raros |

### Riesgos
- **Teórico**: `RepeatableRead` permite phantom reads (filas nuevas insertadas por otra transacción). Pero el `FOR UPDATE` en la fila de cupo_diario ya protege lo crítico (el conteo de asignaciones).
- **Mitigación**: El `ON CONFLICT DO NOTHING` en la línea 212 protege contra inserts duplicados de cupo.
- **Doble asignación de mismo cliente**: El query de exclude (línea 158) filtra clientes ya asignados ANTES de la transacción. Con `RepeatableRead`, dos promotores podrían teóricamente seleccionar el mismo cliente. Pero las oportunidades se crean con `createMany` (no hay unique constraint en cliente_id+activo), así que esto solo resultaría en asignación duplicada que se puede prevenir con un índice parcial único.

**Mitigación adicional recomendada**: Agregar índice parcial único:
```sql
CREATE UNIQUE INDEX idx_oportunidad_cliente_activo
ON oportunidades (cliente_id)
WHERE activo = true AND cliente_id IS NOT NULL;
```

---

## 5. Importación de Captaciones — Batch Insert

### Estado actual
```typescript
// src/app/api/captaciones/importar/route.ts — líneas 149-188
await prisma.$transaction(async (tx) => {
  for (const { rowNum, datos } of rows) {
    await tx.oportunidades.create({...});   // 1 query
    await tx.captaciones.create({...});      // 1 query
    await tx.historial.create({...});        // 1 query
  }
});
```
Para 100 filas = 300 queries individuales dentro de UNA transacción.

### Problema
- Transacción larga mantiene locks durante toda la importación
- Bloquea otros promotores que intentan crear oportunidades
- Con 200 filas, la transacción puede durar 5-10 segundos

### Propuesta
Usar `createMany` en lotes de 50:

**Archivo**: `src/app/api/captaciones/importar/route.ts` — reemplazar líneas 149-188
```typescript
const BATCH_SIZE = 50;
let created = 0;

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);

  await prisma.$transaction(async (tx) => {
    // Crear oportunidades en batch
    const opData = batch.map(({ datos }) => ({
      cliente_id: null as number | null,
      usuario_id: userId,
      etapa_id: etapaAsignado?.id ?? null,
      origen: "CAPTACION" as const,
      timer_vence: timerVence,
      activo: true,
    }));

    await tx.oportunidades.createMany({ data: opData });

    // Obtener las oportunidades recién creadas
    const nuevasOps = await tx.oportunidades.findMany({
      where: {
        usuario_id: userId,
        origen: "CAPTACION",
        created_at: { gte: new Date(Date.now() - 60000) },
      },
      orderBy: { id: "desc" },
      take: batch.length,
    });

    // Crear captaciones e historial en batch
    await tx.captaciones.createMany({
      data: nuevasOps.map((op, idx) => ({
        oportunidad_id: op.id,
        usuario_id: userId,
        origen_captacion,
        convenio,
        datos_json: batch[batch.length - 1 - idx].datos,
      })),
    });

    await tx.historial.createMany({
      data: nuevasOps.map((op) => ({
        oportunidad_id: op.id,
        usuario_id: userId,
        tipo: "CAPTACION",
        etapa_nueva_id: etapaAsignado?.id ?? null,
        nota: "Importación masiva",
      })),
    });

    created += batch.length;
  });
}
```

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Queries por 100 filas | 300 individuales | ~9 (3 batches × 3 queries) |
| Duración de transacción | 5-10s continua | ~1s por batch de 50 |
| Locks en DB | Toda la importación | Solo durante cada batch |
| Manejo de errores | Se pierde todo si falla una fila | Se pierden max 50 filas del batch fallido |
| Nota en historial | Incluye número de fila | Genérico "Importación masiva" |

### Riesgos
- **Atomicidad parcial**: Antes, toda la importación era atómica (todo o nada). Ahora, si el batch 2 falla, el batch 1 ya se guardó. Esto es **aceptable** porque:
  - El usuario ve cuántos se crearon y puede re-importar los faltantes
  - Mejor 50 guardados + error que 0 guardados + error
- **Matching de IDs**: La lógica de buscar oportunidades recién creadas por timestamp es aproximada. Funciona porque el `userId` + `origen` + `created_at` reciente es suficientemente específico dentro de una transacción.

---

## 6. Dashboard Admin — Uso de `_count` / Raw Query

### Estado actual
```typescript
// src/app/api/admin/dashboard/route.ts — líneas 35-43
prisma.usuarios.findMany({
  where: { rol: "promotor", activo: true },
  select: {
    lotes: { select: { cantidad: true } },             // Carga TODOS los lotes
    oportunidades: { where: { activo: true }, select: { id: true } },  // Carga TODAS las ops
  },
})
```
Con 200 promotores × 50 lotes × 200 oportunidades = 50,000 registros cargados en memoria.

### Propuesta
Usar aggregaciones en lugar de cargar datos completos:

**Alternativa con raw query**:
```sql
SELECT u.id, u.nombre,
  COUNT(DISTINCT l.id) as total_lotes,
  COALESCE(SUM(l.cantidad), 0) as total_asignados,
  (SELECT COUNT(*) FROM oportunidades o WHERE o.usuario_id = u.id AND o.activo = true) as oportunidades_activas
FROM usuarios u
LEFT JOIN lotes l ON l.usuario_id = u.id
WHERE u.rol = 'promotor' AND u.activo = true
GROUP BY u.id, u.nombre
```

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Datos cargados en memoria | ~50,000 registros | 200 filas agregadas |
| Tiempo de respuesta estimado | 200-500ms | 30-80ms |
| Payload de respuesta | Mismo (ya se mapea a resumen) | Mismo |

### Riesgos
- Cambiar de ORM a raw query reduce la seguridad de tipos. Mitigación: definir interface para el resultado.
- Los totales de `lotes.cantidad` se suman con `SUM` en vez de JavaScript reduce. Resultado idéntico.

---

## 7. Cron de Timers — `updateMany` en vez de loop

### Estado actual
```typescript
// src/app/api/cron/check-timers/route.ts — líneas 31-38
await prisma.$transaction(
  vencidas.map((op) =>
    prisma.oportunidades.update({
      where: { id: op.id },
      data: { activo: false, etapa_id: null, timer_vence: null },
    })
  )
);
```
Si vencen 200 oportunidades a la vez = 200 UPDATEs individuales en una transacción.

### Propuesta
```typescript
// DESPUÉS: una sola query
const ids = vencidas.map(op => op.id);
await prisma.oportunidades.updateMany({
  where: { id: { in: ids } },
  data: { activo: false, etapa_id: null, timer_vence: null },
});
```

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Queries UPDATE | N individuales | 1 con IN clause |
| Tiempo de transacción | 50-200ms (N updates) | 5-15ms (1 updateMany) |
| Atomicidad | Todas en transacción explícita | updateMany es atómica por sí sola |
| Resultado | Cada update retorna el record | updateMany retorna count |

### Riesgos
- Ninguno. El `updateMany` aplica los mismos cambios a los mismos IDs. La semántica es idéntica.

---

## 8. Índices Faltantes

### Estado actual (schema.prisma)
Los índices existentes cubren los queries más frecuentes, pero faltan algunos para queries específicos.

### Propuesta — Agregar estos índices
```prisma
// modelo oportunidades — agregar:
@@index([etapa_id, activo])         // Para filtros de bandeja admin y dashboard
@@index([lote_id])                  // Para búsqueda de ops por lote
@@index([origen])                   // Para filtros por origen en admin

// modelo historial — agregar:
@@index([tipo])                     // Para filtros de historial por tipo

// modelo cupo_diario — agregar:
@@index([fecha])                    // Para queries por fecha sin usuario_id

// modelo wa_campanas — agregar:
@@index([sesion_id])                // Para joins con wa_sesiones
@@index([usuario_id, estado])       // Para filtrar campañas activas de un usuario
```

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Query de bandeja (etapa+activo) | Seq scan en oportunidades | Index scan |
| Query de historial por tipo | Seq scan | Index scan |
| Espacio en disco | — | ~5-15 MB adicionales (depende de volumen de datos) |
| Velocidad de INSERT | — | Marginalmente más lento (mantener índices) |

### Riesgos
- Los índices usan espacio en disco y hacen los INSERTs ligeramente más lentos. Con el volumen de este sistema (~100K-500K filas), el impacto es despreciable.
- `@@index([lote_id])` en oportunidades: Prisma ya genera un índice implícito por la relation FK. Verificar si ya existe antes de agregar.

---

## 9. Next.js — Compression y Headers

### Estado actual
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: "standalone",
};
```

### Propuesta
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
};
```

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Compresión gzip | Solo si el host lo hace | Next.js comprime responses |
| Header `X-Powered-By` | Expuesto | Removido (seguridad menor) |
| Strict mode | Default | Explícito |
| Payload de responses JSON grandes | 50-100KB | 10-20KB comprimido |

### Riesgos
- `compress: true` usa CPU del servidor para comprimir. Con 200 usuarios, el overhead de compresión es menor que el ahorro de bandwidth. Net positivo.
- Railway probablemente ya comprime en su proxy. En ese caso, `compress: true` es redundante pero no dañino.

---

## 10. GET de Asignaciones (Lotes) — Thundering Herd

### Estado actual
```typescript
// src/app/api/asignaciones/route.ts — líneas 27-73
const result = await Promise.all(
  lotes.map(async (lote) => {
    // 1-2 queries POR LOTE
    const ediciones = await prisma.datos_contacto.findMany({...});
    const conTel1Original = await prismaClientes.clientes.count({...});
  })
);
```
Si un promotor tiene 20 lotes, son 20-40 queries en paralelo.

### Propuesta
Batch las queries fuera del loop:

**Archivo**: `src/app/api/asignaciones/route.ts` — GET handler
```typescript
// 1. Obtener todos los clienteIds de todos los lotes
const allClienteIds = lotes.flatMap(l =>
  l.oportunidades.map(o => o.cliente_id).filter(Boolean)
);
const uniqueClienteIds = [...new Set(allClienteIds)];

// 2. Dos queries batch en paralelo
const [allEdiciones, clientesConTel1Count] = await Promise.all([
  uniqueClienteIds.length > 0
    ? prisma.datos_contacto.findMany({
        where: { cliente_id: { in: uniqueClienteIds }, campo: "tel_1" },
        orderBy: { created_at: "desc" },
      })
    : [],
  uniqueClienteIds.length > 0
    ? prismaClientes.clientes.findMany({
        where: { id: { in: uniqueClienteIds }, tel_1: { not: null } },
        select: { id: true },
      })
    : [],
]);

// 3. Construir sets para lookup O(1) por lote
const editadosSet = new Set(allEdiciones.map(e => e.cliente_id));
const conTel1OriginalSet = new Set(clientesConTel1Count.map(c => c.id));

// 4. Map sin queries adicionales
const result = lotes.map(lote => {
  const clienteIds = lote.oportunidades.map(o => o.cliente_id).filter(Boolean);
  const conEdicion = clienteIds.filter(id => editadosSet.has(id!)).length;
  const sinEdicion = clienteIds.filter(id => !editadosSet.has(id!));
  const conTel1Original = sinEdicion.filter(id => conTel1OriginalSet.has(id!)).length;
  const registros_con_tel1 = conEdicion + conTel1Original;
  return {
    id: lote.id,
    fecha: lote.fecha,
    cantidad: lote.cantidad,
    oportunidades_activas: clienteIds.length,
    registros_con_tel1,
    puede_descargar: registros_con_tel1 === clienteIds.length && clienteIds.length > 0,
  };
});
```

### Cambio de comportamiento
| Aspecto | Antes | Después |
|---------|-------|---------|
| Queries por request | 2 × N lotes (20-40) | 2 fijas (batch) |
| Conexiones de pool usadas | N simultáneas | 2 simultáneas |
| Cálculo de tel_1 | Exacto por lote | Exacto (misma lógica, datos pre-cargados) |

### Riesgos
- El count de clientes con tel_1 cambió de `count()` a `findMany + Set`. El resultado es idéntico pero usa un poco más de memoria (lista de IDs vs número). Para el volumen del sistema (<10K IDs por request), esto es negligible.

---

## Orden de Implementación Recomendado

| Prioridad | Cambio | Esfuerzo | Impacto |
|-----------|--------|----------|---------|
| 1 | Pool de conexiones (`.env`) | 5 min | CRITICO |
| 2 | Índices faltantes (`schema.prisma`) | 15 min | ALTO |
| 3 | Cache de configuración | 1 hora | ALTO |
| 4 | Paralelizar oportunidades GET | 30 min | ALTO |
| 5 | Isolation level de asignaciones | 15 min | ALTO |
| 6 | Cron updateMany | 10 min | MEDIO |
| 7 | next.config.ts | 5 min | BAJO |
| 8 | Dashboard con _count/raw | 45 min | MEDIO |
| 9 | Batch import captaciones | 1 hora | MEDIO |
| 10 | Batch GET lotes | 1 hora | MEDIO |

**Tiempo total estimado: ~5-6 horas de implementación**

---

## Verificación Post-Implementación

1. **Pool de conexiones**: Verificar en Railway que las conexiones activas no excedan el límite del plan
2. **Cache**: Cambiar configuración desde admin, verificar que promotores ven el cambio dentro de 5 min
3. **Oportunidades GET**: Medir tiempo de respuesta con promotor que tiene 200+ oportunidades
4. **Asignaciones POST**: Simular 10 requests POST concurrentes y verificar que no hay timeouts ni dobles asignaciones
5. **Captaciones import**: Importar archivo de 100+ filas y verificar que todos los registros se crean correctamente
6. **Dashboard**: Verificar que los números de porPromotor coinciden con los anteriores
7. **Cron**: Ejecutar check-timers con 50+ oportunidades vencidas y verificar que todas se desactivan
8. **Índices**: Ejecutar `EXPLAIN ANALYZE` en las queries principales para confirmar uso de índices

---

## Lo que NO se modifica

- Lógica de negocio (reglas de cupo, etapas, embudo)
- Estructura de tablas/modelos
- Endpoints de API (mismas rutas, mismos payloads)
- Frontend (cero cambios en componentes React)
- Auth/middleware (JWT sigue igual)
- WhatsApp microservice (opera independiente)
