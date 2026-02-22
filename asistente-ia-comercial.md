# Proyecto: Asistente IA para Área Comercial

## Resumen del Proyecto

Construir un asistente de inteligencia artificial conversacional para el **área comercial de la empresa**, que permita consultar múltiples bases de datos PostgreSQL en lenguaje natural y generar respuestas ejecutivas, rankings, resúmenes y gráficas automáticamente.

---

## Infraestructura Actual

- **Plataforma:** Railway Pro
- **RAM disponible:** ~32 GB (con uso actual menor a 20 GB)
- **Bases de datos:** PostgreSQL (6 bases de datos, ver detalle abajo)
- **Servicios actuales:** Múltiples servicios corriendo en Railway

---

## Decisiones de Arquitectura Tomadas

| Decisión | Elección | Razón |
|---|---|---|
| ¿Dónde corre el modelo? | Railway Pro (mismo proyecto) | RAM disponible sin costo adicional |
| ¿Qué motor de modelo? | **Ollama** | Diseñado para ser servidor, privado, sin costo por token |
| ¿Qué modelo de lenguaje? | **Llama 3.1 8B o Qwen2.5 7B** | Buen balance calidad/RAM, responde bien en español, razona sobre SQL |
| ¿Interfaz de usuario? | **Integrada al Next.js existente** | Sin servicio nuevo, ruta `/asistente` en proyecto actual |
| ¿Next.js Router? | **Pages Router** | El proyecto usa `pages/` |
| ¿Autenticación? | **Reutiliza la existente** | Ya hay login implementado en el proyecto |
| ¿Dónde viven los datos? | Todo en Railway | Los datos nunca salen a servicios externos |

---

## Arquitectura Final

```
Railway Pro
├── PostgreSQL x6 (ya existen)
├── Tus servicios actuales (ya existen)
│
├── ✏️  Servicio: tu Next.js existente (Pages Router)
│     └── pages/asistente.tsx         ← ruta /asistente (nueva)
│     └── pages/api/asistente.ts      ← proxy al agente (nueva)
│     └── components/asistente/       ← componentes del chat (nuevos)
│     └── Autenticación existente     ← se reutiliza tal cual
│
├── 🆕 Servicio: ollama
│     └── Imagen: ollama/ollama
│     └── Modelo: llama3.1:8b o qwen2.5:7b
│     └── RAM estimada: 6-10 GB
│
└── 🆕 Servicio: agente-api
      └── Python + FastAPI
      └── LangChain (SQL Agent multi-DB)
      └── Se conecta a Ollama por red interna
      └── Se conecta a las 6 DBs por red interna Railway
```

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Interfaz | Next.js (React) |
| Gráficas | Chart.js |
| Autenticación | JWT |
| Backend / Agente | Python + FastAPI |
| Orquestación IA | LangChain (SQL Agent) |
| Modelo de lenguaje | Ollama (Llama 3.1 8B / Qwen2.5 7B) |
| Bases de datos | PostgreSQL x6 en Railway |
| Despliegue | Railway Pro |

---

## Las 6 Bases de Datos

### 1. Ventas
Registra todas las transacciones comerciales.
- Consultas esperadas: rankings de vendedores por monto, ventas por convenio, procedencia de clientes, rendimiento por período.

### 2. Plantilla RH
Gestión de recursos humanos: altas, bajas, cambios y reclutamiento.
- Consultas esperadas: reclutador con más contrataciones, meses con más altas/bajas, tendencias de plantilla, análisis de rotación.

### 3. Capacidades_Multiconvenios
Capacidades de crédito de clientes por convenio.
- Ejemplo: cliente X tiene $4,355.00 de capacidad disponible.
- Consultas esperadas: capacidad disponible por cliente, distribución por convenio, totales.

### 4. Consulta_Buscador
Base de acceso a la general de clientes para que promotores busquen datos de clientes registrados.
- Consultas esperadas: datos de clientes específicos, búsquedas por criterio.

### 5. Asignador BD
Clientes trabajados por los promotores desde la base principal. Contiene un embudo de ventas.
- Consultas esperadas: clientes trabajados por promotor, avance en el embudo, tasa de conversión por promotor.

### 6. Prospectos GONA
Universo de clientes pendientes por trabajar.
- Consultas esperadas: cuántos prospectos quedan, segmentación, distribución por zona o convenio.

---

## Preguntas Tipo que Debe Responder el Asistente

### Ventas
- ¿Quién vendió más hoy / esta semana / este mes / semestre / año?
- ¿Qué convenio se vendió más en X período?
- Ranking de ventas por monto
- Ranking de ventas por convenio
- ¿De dónde vienen los clientes? (lugares de procedencia)
- Resumen ejecutivo del rendimiento de un convenio específico

### RH
- ¿Qué reclutador contrató más esta semana / mes / semestre / año?
- ¿En qué mes se dieron más altas?
- ¿En qué mes se dieron más bajas?
- Tendencia de plantilla a lo largo del tiempo

### Embudo Comercial
- ¿Cuántos clientes está trabajando cada promotor?
- Tasa de conversión por promotor
- ¿En qué etapa del embudo están los clientes?

### Prospectos
- ¿Cuántos prospectos quedan por trabajar?
- Distribución de prospectos por zona / convenio

### Gráficas (automáticas cuando aplique)
- Barras: ventas por mes, altas/bajas por mes
- Pastel: distribución por convenio, procedencia de clientes
- Línea: tendencias a lo largo del tiempo
- Tabla: rankings

---

## Características del Frontend

- **Login:** usuario y contraseña individual por persona del área comercial
- **Chat:** interfaz conversacional limpia, estilo ChatGPT
- **Gráficas:** se generan automáticamente cuando la respuesta lo amerita
- **Historial:** cada usuario ve sus conversaciones anteriores
- **Responsive:** funciona en Windows y Mac desde el navegador
- **Indicador de carga:** muestra "pensando..." mientras el agente consulta las DBs

---

## Estructura del Proyecto (archivos nuevos en tu Next.js)

```
tu-proyecto-nextjs/               ← ya existe en Railway
│
├── pages/
│   ├── (tus páginas actuales)    ← no se tocan
│   └── asistente.tsx             ← 🆕 ruta /asistente — chat principal
│
├── pages/api/
│   ├── (tus apis actuales)       ← no se tocan
│   └── asistente.ts              ← 🆕 proxy hacia agente FastAPI
│
└── components/
    ├── (tus componentes actuales) ← no se tocan
    └── asistente/
        ├── ChatMessage.tsx        ← 🆕 burbuja de mensaje
        ├── ChatInput.tsx          ← 🆕 input de texto
        └── ChartRenderer.tsx      ← 🆕 gráficas Chart.js automáticas

─────────────────────────────────────────────
backend/                           ← 🆕 nuevo servicio en Railway
├── main.py                        ← FastAPI app
├── agent.py                       ← SQL Agent LangChain multi-DB
├── database.py                    ← conexiones a las 6 DBs
├── prompts.py                     ← system prompt con contexto del negocio
├── chart_helper.py                ← detecta cuándo generar gráfica
├── requirements.txt
└── Dockerfile
```

---

## Variables de Entorno Necesarias (Railway)

### agente-api
```env
# Ollama (red interna Railway)
OLLAMA_URL=http://ollama.railway.internal:11434
OLLAMA_MODEL=llama3.1:8b

# Bases de datos PostgreSQL (conexiones internas Railway)
DB_VENTAS_URL=postgresql://...
DB_RH_URL=postgresql://...
DB_CAPACIDADES_URL=postgresql://...
DB_BUSCADOR_URL=postgresql://...
DB_ASIGNADOR_URL=postgresql://...
DB_PROSPECTOS_URL=postgresql://...

# Auth
JWT_SECRET=tu_secreto_aqui
JWT_EXPIRY_HOURS=8
```

### frontend
```env
NEXT_PUBLIC_API_URL=https://agente-api.tu-dominio.railway.app
```

---

## Plan de Implementación

### Fase 1 — Ollama en Railway (1-2 días)
- Crear servicio con imagen `ollama/ollama`
- Descargar modelo: `ollama pull llama3.1:8b`
- Verificar que responde por red interna

### Fase 2 — Agente Backend (2-3 días)
- Configurar conexiones a las 6 DBs
- Implementar SQL Agent multi-DB con LangChain
- Escribir prompt de sistema con contexto del negocio
- Probar preguntas clave desde Postman/terminal

### Fase 3 — Frontend (2-3 días)
- Chat con autenticación JWT
- Renderizado de gráficas automático
- Historial de conversaciones

### Fase 4 — Ajuste y pruebas (2-3 días)
- Probar con el área comercial
- Ajustar prompt de sistema según feedback
- Optimizar queries lentas

**Total estimado: 1-2 semanas** para versión funcional

---

## Costo Estimado Mensual

| Servicio | Costo |
|---|---|
| Railway Pro (ya pagado) | $0 adicional |
| Next.js frontend (ya existe) | $0 adicional |
| Ollama (nuevo servicio) | ~$0-5 USD (cómputo extra en Railway) |
| Modelo Llama/Qwen | $0 (open source) |
| **Total adicional** | **~$0-5 USD/mes** |

---

## Pendiente para Continuar

> ⚠️ **El siguiente paso es compartir los esquemas completos de las 6 bases de datos.**

El esquema de las tablas es necesario para:
1. Configurar correctamente el SQL Agent (sabe qué tablas/columnas existen)
2. Escribir el prompt de sistema con el contexto real del negocio
3. Generar el código del `agent.py` y `database.py` adaptado a tu estructura

**Formas de compartir el esquema:**
- Script SQL con los `CREATE TABLE` de cada base
- Captura de pantalla de pgAdmin / DBeaver / TablePlus
- Texto describiendo tabla por tabla con sus columnas
- Archivo dump del esquema

Una vez compartidos los esquemas, se puede generar el código base completo del proyecto listo para desplegar en Railway.
