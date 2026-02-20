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