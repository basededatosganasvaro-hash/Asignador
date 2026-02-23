# Plan: Streaming SSE de pasos intermedios del agente IA

## Contexto

Actualmente el usuario envía una pregunta y solo ve "Pensando..." con un spinner hasta que llega la respuesta completa (puede tardar 30s-2min). En la consola del backend se ven todos los pasos del agente (consultar esquema, ejecutar SQL, analizar). El objetivo es mostrar esos pasos resumidos en tiempo real en el chat para que el usuario sepa que la IA está trabajando activamente.

## Flujo propuesto

```
Browser (ChatPanel)
  <── SSE stream ──
Next.js /api/asistente (route.ts)     [pipe SSE + guarda en BD al final]
  <── SSE stream ──
FastAPI /chat/stream (chat.py)        [nuevo endpoint SSE]
  <── asyncio.Queue ──
LangChain SQL agent (sql_agent.py)    [StreamingStepHandler → queue]
```

## Formato SSE (contrato entre todas las capas)

```
data: {"type":"step","content":"Consultando esquema de base de datos..."}
data: {"type":"step","content":"Ejecutando consulta SQL..."}
data: {"type":"step","content":"SELECT COUNT(*) FROM ventas WHERE..."}
data: {"type":"step","content":"Analizando resultados..."}
data: {"type":"done","respuesta":"...","sql_queries":[...],"chart":null,"model":"...","duration_ms":123}
data: {"type":"error","content":"El servicio no está disponible..."}
```

## Archivos a modificar (4)

| # | Archivo | Cambios |
|---|---------|---------|
| 1 | `backend-ia/app/agents/sql_agent.py` | + `StreamingStepHandler`, + `query_databases_stream()` async generator, refactor helpers compartidos |
| 2 | `backend-ia/app/routes/chat.py` | + endpoint `POST /chat/stream` con `StreamingResponse` SSE |
| 3 | `src/app/api/asistente/route.ts` | Cambiar de JSON a `ReadableStream` SSE; pipe steps al browser, guardar en BD en evento `done` |
| 4 | `src/components/asistente/ChatPanel.tsx` | + state `agentSteps`, leer stream SSE en `handleSend`, mostrar pasos en vivo |

---

## Paso 1: `backend-ia/app/agents/sql_agent.py`

### 1a. Extraer helpers compartidos

Extraer de `query_databases()` tres funciones reutilizables:

- `_build_history_context(historial)` → string
- `_get_primary_db(databases)` → (db, name)
- `_build_prefix(history_context, primary_name, db_list)` → string

Refactorizar `query_databases()` para usarlos (mantener endpoint original funcional).

### 1b. `StreamingStepHandler(BaseCallbackHandler)`

- Recibe `queue: asyncio.Queue` y `loop` (event loop)
- Usa `loop.call_soon_threadsafe(queue.put_nowait, event)` para push thread-safe
- Traduce eventos de LangChain a mensajes resumidos:

| Callback | Tool | Mensaje al usuario |
|----------|------|--------------------|
| `on_agent_action` | `sql_db_list_tables` | "Consultando esquema de base de datos..." |
| `on_agent_action` | `sql_db_schema` / `schema_*_db` | "Obteniendo estructura de tabla..." |
| `on_agent_action` | `sql_db_query` / `query_*_db` | "Ejecutando consulta SQL..." + SQL truncado a 200 chars |
| `on_tool_end` | (cualquiera) | "Analizando resultados..." |
| `on_tool_error` | (cualquiera) | "Reintentando consulta..." |
| `on_agent_finish` | — | "Generando respuesta..." |

- También acumula `sql_queries[]` (reemplaza `SQLCaptureHandler` en el path streaming)

### 1c. `query_databases_stream()` async generator

- Yield inicial `{"type":"step","content":"Analizando consulta..."}`
- Crea `asyncio.Queue(maxsize=100)` y `StreamingStepHandler`
- Lanza `agent.invoke()` en `asyncio.to_thread()` (no bloquea event loop)
- Loop: `await queue.get()` → yield steps → cuando llega resultado con key `"output"` → yield evento `done`
- Catch exceptions → yield evento `error`

---

## Paso 2: `backend-ia/app/routes/chat.py`

Agregar endpoint (el `POST /chat` original NO se toca):

```python
@router.post("/chat/stream", dependencies=[Depends(verify_api_key)])
async def chat_stream(request: ChatRequest):
    async def generate():
        async for event in query_databases_stream(request.mensaje, request.historial):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})
```

Header `X-Accel-Buffering: no` es crítico para Railway (nginx proxy).

---

## Paso 3: `src/app/api/asistente/route.ts`

Cambiar el POST handler:

- Validación y creación de conversación: igual que antes (JSON responses para errores de auth/validación)
- Después de guardar mensaje del usuario: hacer `fetch` a `/chat/stream` en vez de `/chat`
- Retornar `new Response(ReadableStream, {headers: {"Content-Type":"text/event-stream"}})`
- Dentro del ReadableStream:
  - Leer stream de FastAPI línea por línea
  - Eventos `step` → forward directo al browser
  - Evento `done` → guardar `ia_mensajes` + `ia_conversaciones` en BD → forward al browser con `conversacion_id` y `mensaje.id`
  - Evento `error` → guardar placeholder en BD → forward al browser
  - Catch global → guardar error en BD → enviar error event

---

## Paso 4: `src/components/asistente/ChatPanel.tsx`

### State nuevo

```typescript
const [agentSteps, setAgentSteps] = useState<string[]>([]);
```

### `handleSend` modificado

- Cambia de `await res.json()` a leer `res.body` como stream SSE
- Parsea cada línea `data: {...}`
- `step` → `setAgentSteps(prev => [...prev, content])`
- `done` → `setMessages(prev => [...prev, evento.mensaje])`, `setAgentSteps([])`
- `error` → `setErrorMsg(content)`
- Fallback: si `!res.ok || !res.body` → leer como JSON (errores de auth)

### UI del spinner (reemplaza "Pensando...")

```
[CircularProgress] Ejecutando consulta SQL...     ← paso más reciente (destacado)
  > Analizando consulta...                        ← pasos anteriores (dimmed, caption)
  > Consultando esquema de base de datos...
```

- Paso más reciente junto al spinner con `Typography variant="body2"`
- Pasos anteriores debajo con `Typography variant="caption" color="text.disabled"`
- Si no hay pasos aún: "Pensando..." (fallback)

---

## Consideraciones técnicas

- **Threading**: `agent.invoke()` es síncrono y bloquea. Se ejecuta en `asyncio.to_thread()` mientras el async generator lee de la queue.
- **Thread-safety**: `call_soon_threadsafe` es el mecanismo correcto para push cross-thread a una asyncio queue.
- **Railway proxy**: Header `X-Accel-Buffering: no` evita que nginx bufferee toda la respuesta.
- **Timeout**: El frontend mantiene `AbortSignal.timeout(120000)` (2 min).
- **Fallback**: El endpoint original `POST /chat` sigue funcionando sin cambios.
- **CORS**: El endpoint `/chat/stream` es POST, ya cubierto por la config actual.

---

## Verificación

1. `curl -N -X POST http://localhost:8000/chat/stream -H "Content-Type: application/json" -d '{"mensaje":"cuantos clientes hay"}'` → ver eventos SSE llegando progresivamente
2. En el browser: preguntar algo → ver pasos aparecer uno por uno debajo del spinner
3. Al terminar: pasos se reemplazan por la respuesta del asistente
4. Backend caído → Snackbar de error (no se rompe el stream)
5. El endpoint original `POST /chat` sigue funcionando sin cambios
6. Los mensajes se guardan en BD exactamente igual que antes (verificar en ia_mensajes)

---

## Estado

**Pendiente de implementación.** Considerar retomar cuando se migre a un modelo más rápido (GPU dedicada o API cloud) para que el streaming tenga mayor impacto en la experiencia del usuario.
