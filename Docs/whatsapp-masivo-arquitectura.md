# Sistema de Mensajería Masiva WhatsApp - Arquitectura y Diseño

> **Contexto:** Sistema diseñado para operación de contact center con ~210 agentes en sector financiero (créditos IMSS/Pensiones). Los agentes se auto-asignan carteras y realizan envíos masivos desde su propio número de WhatsApp, mientras el sistema captura y almacena toda la actividad centralizadamente.

---

## Índice

1. [Concepto General](#concepto-general)
2. [Multi-Sesión con Baileys](#multi-sesión-con-baileys)
3. [Patrones Aleatorios Anti-Spam](#patrones-aleatorios-anti-spam)
4. [Alternativas al Registro de Líneas (PANAUT)](#alternativas-al-registro-de-líneas-panaut)
5. [Arquitectura del Sistema Completo](#arquitectura-del-sistema-completo)
6. [Base de Datos](#base-de-datos)
7. [Interceptor Service](#interceptor-service)
8. [API Endpoints](#api-endpoints)
9. [Lo que se Captura Automáticamente](#lo-que-se-captura-automáticamente)
10. [Stack Tecnológico](#stack-tecnológico) entendido 


---

## Concepto General

El sistema emula el comportamiento de extensiones como **Wappi** pero de forma propia e integrada al CRM. La lógica central es:

```
Agente sube/auto-asigna cartera
         ↓
Sistema valida y registra datos
         ↓
Agente conecta su WhatsApp (QR scan)
         ↓
Agente lanza envío masivo
         ↓
Sistema intercepta y almacena:
  - Número destino
  - Mensaje enviado
  - Timestamp
  - Respuestas recibidas
  - Estado de entrega
         ↓
Supervisores/Admin ven todo en tiempo real
```

**Ventaja clave:** El agente usa su propio número (evita problema de registro PANAUT), la empresa captura todo centralizadamente, y el agente mantiene autonomía operativa.

---

## Multi-Sesión con Baileys

Un solo servidor maneja múltiples números de WhatsApp simultáneamente, cada uno con sesión independiente.

```
Tu Servidor (Railway)
├── Sesión Agente 001 → Número: 55-1234-5678 ✅ Conectado
├── Sesión Agente 002 → Número: 55-8765-4321 ✅ Conectado
├── Sesión Agente 003 → Número: 55-1111-2222 ✅ Conectado
│   ...
└── Sesión Agente 210 → Número: 55-9999-0000 ✅ Conectado
```

### Implementación base

```javascript
const sessions = new Map();

async function crearSesion(agenteId) {
    const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
    
    // Cada agente tiene su propia carpeta de credenciales
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${agenteId}`);
    
    const sock = makeWASocket({ auth: state });
    
    sock.ev.on('creds.update', saveCreds);
    sessions.set(agenteId, sock);
    
    return sock;
}
```

> **Nota de recursos:** Cada sesión de Baileys consume ~50-150 MB de RAM. Para 210 agentes se recomienda implementar sesiones **lazy** (solo activas cuando el agente está trabajando) y almacenar credenciales encriptadas en PostgreSQL en lugar de archivos.

---

## Patrones Aleatorios Anti-Spam

### 1. Delays aleatorios entre mensajes

```javascript
// ❌ Malo - patrón fijo detectable
await sleep(5000);

// ✅ Bueno - distribución con jitter
function delayHumano(min = 3000, max = 15000) {
    const base = Math.random() * (max - min) + min;
    const jitter = (Math.random() - 0.5) * 2000;
    return Math.max(min, base + jitter);
}

// ✅ Mejor - simular tiempo de escritura según longitud
function delayPorLongitud(mensaje) {
    const palabras = mensaje.split(' ').length;
    const msPerPalabra = Math.random() * 200 + 150; // 150-350ms por palabra
    const pausaInicial = Math.random() * 3000 + 1000; // 1-4s antes de empezar
    return pausaInicial + (palabras * msPerPalabra);
}
```

### 2. Simulación de "escribiendo..."

```javascript
async function enviarComoHumano(sock, jid, mensaje) {
    await sock.sendPresenceUpdate('composing', jid);
    await sleep(delayPorLongitud(mensaje));
    await sock.sendPresenceUpdate('paused', jid);
    await sleep(Math.random() * 1500 + 500);
    await sock.sendMessage(jid, { text: mensaje });
}
```

### 3. Variación de mensajes (anti-duplicado)

```javascript
const plantillas = [
    "Hola {nombre}, le contactamos respecto a su crédito IMSS por ${monto}. ¿Le interesa conocer más detalles?",
    "Buenos días {nombre}, tenemos una oferta de crédito disponible para usted por ${monto} a través de IMSS.",
    "Estimado {nombre}, su perfil califica para un crédito de ${monto}. ¿Podemos platicar?",
    "Hola {nombre} 👋 Le escribimos porque tiene disponible un crédito IMSS de ${monto}.",
];

function generarMensaje(datos) {
    const plantilla = plantillas[Math.floor(Math.random() * plantillas.length)];
    let mensaje = plantilla
        .replace('{nombre}', datos.nombre)
        .replace('{monto}', datos.monto);
    
    if (Math.random() > 0.5) {
        const hora = new Date().getHours();
        const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
        mensaje = mensaje.replace('Hola', saludo);
    }
    
    return mensaje;
}
```

### 4. Control de volumen (throttling inteligente)

```javascript
const limitesPorNumero = {
    mensajesPorHora: () => Math.floor(Math.random() * 20) + 30,   // 30-50/hora
    mensajesPorDia:  () => Math.floor(Math.random() * 50) + 150,  // 150-200/día
    pausaEntreRafagas: () => Math.random() * 300000 + 120000,     // 2-7 min
};

const MAX_RAFAGA = () => Math.floor(Math.random() * 8) + 5; // 5-12 mensajes seguidos
```

### 5. Horarios humanizados

```javascript
function estaEnHorarioHumano() {
    const hora = new Date().getHours();
    const dia = new Date().getDay();
    
    if (hora < 8 || hora > 20) return false;
    if (dia === 0) return false; // No domingos
    
    // Reducir en hora comida
    if (hora >= 13 && hora <= 14) {
        return Math.random() > 0.7;
    }
    
    return true;
}
```

### 6. Cola de envío inteligente

```javascript
class ColaEnvioInteligente {
    constructor() {
        this.cola = [];
        this.contadorPorAgente = new Map();
    }
    
    async procesar() {
        while (this.cola.length > 0) {
            if (!estaEnHorarioHumano()) {
                await sleep(60000);
                continue;
            }
            
            const item = this.cola.shift();
            const contador = this.contadorPorAgente.get(item.agenteId) || 0;
            const limite = limitesPorNumero.mensajesPorHora();
            
            if (contador >= limite) {
                this.cola.push(item);
                await sleep(limitesPorNumero.pausaEntreRafagas());
                continue;
            }
            
            await enviarComoHumano(item.sock, item.jid, item.mensaje);
            this.contadorPorAgente.set(item.agenteId, contador + 1);
            await sleep(delayHumano());
        }
    }
}
```

### Límites recomendados

| Parámetro | Valor seguro |
|---|---|
| Mensajes por hora por número | 30-50 |
| Mensajes por día por número | 150-200 |
| Delay entre mensajes | 8-25 segundos |
| Pausa entre ráfagas | 2-7 minutos |
| Mensajes por ráfaga | 5-12 |
| Horario de envío | 8am - 8pm L-S |

> Con 210 agentes y estos límites: **31,500 - 42,000 mensajes diarios** de forma segura.

---

## Alternativas al Registro de Líneas (PANAUT)

### Opción 1: WhatsApp Business API Oficial ✅ Más segura
- No sujeta al PANAUT (usa números virtuales o fijos)
- Sin riesgo de ban
- BSPs recomendados: **Gupshup, Infobip, 360dialog, Twilio**
- Costo: ~$0.01-0.05 USD por conversación

### Opción 2: Números VoIP

| Proveedor | País del número | Compatible WA |
|---|---|---|
| Twilio | USA (+1) | ✅ |
| Vonage | Múltiples | ✅ |
| Telemo.io | Múltiples | ✅ |

Costo aprox: **$1 USD/mes por línea** → 210 agentes = ~$210 USD/mes

### Opción 3: eSIM de otro país
- Airalo, Holafly, Maya Mobile
- Costo: $5-15 USD por línea/mes
- Se activan digitalmente sin trámite físico en México

### Opción 4 (Recomendada): Modelo Híbrido

```
Prospección masiva → WhatsApp API Oficial
(números 800 o virtuales, sin PANAUT)
         ↓
Cliente interesado → Agente específico
(número del agente, conversación 1 a 1)
         ↓
Seguimiento → CRMGONAv3
(registro completo de conversación)
```

---

## Arquitectura del Sistema Completo

```
┌──────────────────────────────────────────────────┐
│              CRM / Panel Agente                  │
│                                                  │
│  [Subir Cartera CSV]  [Auto-asignar datos]       │
│  [Conectar WhatsApp → QR]                        │
│  [Lanzar campaña]     [Ver estado envíos]        │
└──────────────────┬───────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────┐
│           Backend (Railway)                      │
│                                                  │
│  SessionManager (Baileys multi-sesión)           │
│  QueueManager (cola de envíos por agente)        │
│  InterceptorService (captura todo)               │
│  WebSocket (estado en tiempo real)               │
└──────────────────┬───────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────┐
│           PostgreSQL                             │
│                                                  │
│  agentes          sesiones_wa                    │
│  carteras         mensajes_enviados              │
│  contactos        mensajes_recibidos             │
│  campañas         eventos_entrega                │
└──────────────────────────────────────────────────┘
```

---

## Base de Datos

```sql
-- Cartera que sube o auto-asigna el agente
CREATE TABLE carteras (
    id SERIAL PRIMARY KEY,
    agente_id INTEGER REFERENCES agentes(id),
    nombre VARCHAR(100),
    fuente VARCHAR(50), -- 'csv_upload', 'auto_asignacion', 'manual'
    total_contactos INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Contactos de la cartera
CREATE TABLE contactos (
    id SERIAL PRIMARY KEY,
    cartera_id INTEGER REFERENCES carteras(id),
    agente_id INTEGER REFERENCES agentes(id),
    nombre VARCHAR(100),
    telefono VARCHAR(20),        -- número capturado automáticamente
    telefono_wa VARCHAR(30),     -- formato WhatsApp (52XXXXXXXXXX@s.whatsapp.net)
    datos_credito JSONB,         -- monto, tipo crédito, NSS, etc
    estado VARCHAR(30) DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Campañas de envío
CREATE TABLE campanas (
    id SERIAL PRIMARY KEY,
    agente_id INTEGER REFERENCES agentes(id),
    cartera_id INTEGER REFERENCES carteras(id),
    nombre VARCHAR(100),
    plantilla_id INTEGER,
    estado VARCHAR(20) DEFAULT 'pausada', -- activa, pausada, completada
    total_mensajes INTEGER DEFAULT 0,
    enviados INTEGER DEFAULT 0,
    fallidos INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Corazón del sistema: cada mensaje queda registrado
CREATE TABLE mensajes_enviados (
    id SERIAL PRIMARY KEY,
    campana_id INTEGER REFERENCES campanas(id),
    agente_id INTEGER REFERENCES agentes(id),
    contacto_id INTEGER REFERENCES contactos(id),
    numero_origen VARCHAR(20),   -- número del agente (capturado automáticamente)
    numero_destino VARCHAR(20),  -- número del cliente (capturado automáticamente)
    mensaje TEXT,
    wa_message_id VARCHAR(100),  -- ID interno de WhatsApp
    estado VARCHAR(20) DEFAULT 'pendiente', -- enviado, entregado, leido, fallido
    enviado_at TIMESTAMP,
    entregado_at TIMESTAMP,
    leido_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Respuestas recibidas
CREATE TABLE mensajes_recibidos (
    id SERIAL PRIMARY KEY,
    agente_id INTEGER REFERENCES agentes(id),
    mensaje_origen_id INTEGER REFERENCES mensajes_enviados(id),
    numero_origen VARCHAR(20),
    numero_destino VARCHAR(20),
    mensaje TEXT,
    wa_message_id VARCHAR(100),
    recibido_at TIMESTAMP DEFAULT NOW()
);

-- Eventos de entrega (doble palomita, etc)
CREATE TABLE eventos_entrega (
    id SERIAL PRIMARY KEY,
    mensaje_id INTEGER REFERENCES mensajes_enviados(id),
    tipo VARCHAR(20),  -- 'sent', 'delivered', 'read', 'failed'
    timestamp TIMESTAMP DEFAULT NOW()
);
```

---

## Interceptor Service

El núcleo del sistema. Se engancha a cada sesión y captura todo sin intervención del agente.

```javascript
class InterceptorService {
    constructor(db, sessionManager) {
        this.db = db;
        this.sessionManager = sessionManager;
    }

    attachToSession(agenteId, sock) {

        // Capturar número propio del agente al conectar
        sock.ev.on('connection.update', async (update) => {
            if (update.qr) {
                this.emitQR(agenteId, update.qr);
            }
            if (update.connection === 'open') {
                const numeroPropio = sock.user.id.split(':')[0];
                await this.db.query(
                    'UPDATE agentes SET numero_wa = $1 WHERE id = $2',
                    [numeroPropio, agenteId]
                );
            }
        });

        // Interceptar TODO lo que se envía y recibe
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            for (const msg of messages) {
                if (msg.key.fromMe) {
                    await this.registrarEnviado(agenteId, msg);
                } else {
                    await this.registrarRecibido(agenteId, msg);
                }
            }
        });

        // Interceptar actualizaciones de estado (entregado/leído)
        sock.ev.on('message-receipt.update', async (updates) => {
            for (const update of updates) {
                await this.actualizarEstado(update);
            }
        });
    }

    async registrarEnviado(agenteId, msg) {
        const numeroDestino = msg.key.remoteJid.replace('@s.whatsapp.net', '');
        const texto = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || '';

        await this.db.query(`
            INSERT INTO mensajes_enviados 
            (agente_id, numero_destino, mensaje, wa_message_id, estado, enviado_at)
            VALUES ($1, $2, $3, $4, 'enviado', NOW())
        `, [agenteId, numeroDestino, texto, msg.key.id]);
    }

    async registrarRecibido(agenteId, msg) {
        const numeroOrigen = msg.key.remoteJid.replace('@s.whatsapp.net', '');
        const texto = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || '';

        await this.db.query(`
            INSERT INTO mensajes_recibidos
            (agente_id, numero_origen, mensaje, wa_message_id, recibido_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [agenteId, numeroOrigen, texto, msg.key.id]);
    }

    async actualizarEstado(update) {
        const estado = update.receipt.type === 'read' ? 'leido' : 'entregado';
        await this.db.query(`
            UPDATE mensajes_enviados 
            SET estado = $1, ${estado === 'leido' ? 'leido_at' : 'entregado_at'} = NOW()
            WHERE wa_message_id = $2
        `, [estado, update.key.id]);
    }
}
```

---

## API Endpoints

```javascript
// Conectar WhatsApp del agente (genera QR via WebSocket)
POST /api/sesion/conectar/:agenteId

// Subir cartera CSV
POST /api/cartera/subir
// Body: multipart/form-data con archivo CSV

// Auto-asignación de datos del pool
POST /api/cartera/auto-asignar
// Body: { agenteId, cantidad }

// Lanzar campaña
POST /api/campana/iniciar
// Body: { campanaId, plantillaId, configDelay }

// Estado en tiempo real (WebSocket)
GET /api/campana/:id/estado

// Pausar/reanudar campaña
PATCH /api/campana/:id/estado
// Body: { estado: 'pausada' | 'activa' }

// Historial completo para supervisores
GET /api/reportes/mensajes
// Query params: ?agenteId=&fecha=&estado=&numero=

// Estado de sesiones activas
GET /api/sesiones/estado
```

---

## Lo que se Captura Automáticamente

Sin ninguna acción extra del agente, el sistema registra:

- ✅ Número de WhatsApp real del agente
- ✅ Cada número al que envía mensaje
- ✅ Contenido exacto de cada mensaje
- ✅ Timestamp exacto de envío
- ✅ Si fue entregado y cuándo
- ✅ Si fue leído y cuándo
- ✅ Cada respuesta que recibe el cliente
- ✅ Qué cartera usó y de dónde vino
- ✅ A qué campaña pertenece cada mensaje

---

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Backend | Node.js + Express |
| WhatsApp | @whiskeysockets/baileys |
| Base de datos | PostgreSQL |
| Tiempo real | WebSocket (ws / socket.io) |
| Hosting | Railway |
| Frontend (CRM) | React (CRMGONAv3) |
| Cola de mensajes | Implementación propia con Map + async |

### Instalación de dependencias clave

```bash
npm install @whiskeysockets/baileys
npm install pg                      # PostgreSQL client
npm install socket.io               # WebSockets
npm install multer                  # Upload de CSV
npm install csv-parser              # Parseo de CSV
npm install express
```

---

## Próximos pasos sugeridos

1. **SessionManager + InterceptorService** — Núcleo del sistema
2. **Esquema de BD** — Migración en PostgreSQL
3. **API REST base** — Endpoints de sesión y campaña
4. **Cola de envío inteligente** — Con patrones anti-spam
5. **Integración CRMGONAv3** — Panel de agente + supervisor
6. **WebSocket** — Estado en tiempo real

---

*Documento generado como referencia de arquitectura — Sistema de Mensajería Masiva WhatsApp para Contact Center*
