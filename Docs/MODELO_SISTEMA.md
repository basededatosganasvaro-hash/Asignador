# Modelo del Sistema de Asignacion y Gestion Comercial

## Arquitectura de Bases de Datos

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   BD CLIENTES (Railway) │     │   BD SISTEMA (Railway)  │
│   Solo lectura desde    │     │   Operacion completa    │
│   el sistema            │◄────│                         │
│                         │     │                         │
│ - clientes              │     │ - usuarios              │
│ - catalogo_estados      │     │ - organizacion          │
│ - catalogo_convenios    │     │ - embudo                │
│                         │     │ - oportunidades         │
│                         │     │ - historial             │
│                         │     │ - configuracion         │
└─────────────────────────┘     └─────────────────────────┘
```

- **BD Clientes**: fuente de datos, no se modifica desde el sistema. Los datos de contacto editados se guardan en BD Sistema.
- **BD Sistema**: toda la operacion, usuarios, oportunidades, historial, configuracion.

---

## Tablas de BD Sistema

### 1. Organizacion

#### `regiones`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| nombre | VARCHAR(200) | Nombre de la region |
| activo | BOOLEAN | |
| created_at | TIMESTAMP | |

#### `zonas`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| region_id | INT FK → regiones | |
| nombre | VARCHAR(200) | |
| activo | BOOLEAN | |

#### `sucursales`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| zona_id | INT FK → zonas | |
| nombre | VARCHAR(200) | |
| direccion | TEXT | |
| activo | BOOLEAN | |

#### `equipos`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| sucursal_id | INT FK → sucursales | |
| nombre | VARCHAR(200) | Ej: "Equipo 1", "Equipo Norte" |
| supervisor_id | INT FK → usuarios | Supervisor asignado |
| activo | BOOLEAN | |

### 2. Usuarios

#### `usuarios`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| nombre | VARCHAR(200) | |
| email | VARCHAR(300) UNIQUE | Login |
| password_hash | TEXT | |
| rol | VARCHAR(30) | admin, gerente_regional, gerente_sucursal, supervisor, promotor |
| equipo_id | INT FK → equipos (nullable) | Equipo al que pertenece (promotor/supervisor) |
| sucursal_id | INT FK → sucursales (nullable) | Para gerente_sucursal |
| region_id | INT FK → regiones (nullable) | Para gerente_regional |
| activo | BOOLEAN | Soft delete |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Reglas de asignacion organizacional:**
- `promotor`: tiene `equipo_id`
- `supervisor`: tiene `equipo_id` (y es el `supervisor_id` del equipo)
- `gerente_sucursal`: tiene `sucursal_id`
- `gerente_regional`: tiene `region_id`
- `admin`: no tiene asignacion organizacional, ve todo

### 3. Plan de Trabajo

#### `planes_trabajo`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| sucursal_id | INT FK → sucursales | Sucursal que trabaja estos convenios |
| convenio | VARCHAR(300) | Nombre del convenio (ref a catalogo_convenios en BD Clientes) |
| creado_por | INT FK → usuarios | Gerente regional que lo creo |
| activo | BOOLEAN | Se puede desactivar sin borrar |
| created_at | TIMESTAMP | |

**Notas:**
- Cambia frecuentemente (incluso diario)
- Solo afecta la asignacion del pool, no limita la captacion
- Gerente regional administra los planes de todas sus sucursales

### 4. Embudo de Ventas (configurable por admin)

#### `embudo_etapas`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| nombre | VARCHAR(100) | Ej: "Contactado", "Interesado" |
| orden | INT | Posicion en el flujo (1, 2, 3...) |
| tipo | VARCHAR(20) | AVANCE, SALIDA, FINAL |
| timer_horas | INT (nullable) | Horas max antes de vencer. NULL = sin timer |
| color | VARCHAR(7) | Hex color para UI |
| activo | BOOLEAN | |

**Tipos de etapa:**
- `AVANCE`: flujo principal (Asignado, Contactado, Interesado, Negociacion)
- `SALIDA`: derivacion negativa (No contactado, No interesado, Negociacion caida). Siempre pasa por supervisor.
- `FINAL`: terminal (Venta, Descartado)

**Etapas iniciales del sistema:**

| Orden | Nombre | Tipo | Timer |
|-------|--------|------|-------|
| 1 | Asignado | AVANCE | Configurable |
| 2 | Contactado | AVANCE | Configurable |
| 3 | Interesado | AVANCE | Configurable |
| 4 | Negociacion | AVANCE | Configurable |
| 5 | Venta | FINAL | - |
| - | No contactado | SALIDA | - |
| - | No interesado | SALIDA | - |
| - | Negociacion caida | SALIDA | - |
| - | Descartado | FINAL | - |

#### `embudo_transiciones`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| etapa_origen_id | INT FK → embudo_etapas | Desde donde |
| etapa_destino_id | INT FK → embudo_etapas | Hacia donde |
| nombre_accion | VARCHAR(100) | Ej: "Marcar como contactado" |
| requiere_nota | BOOLEAN | Obligatorio dejar comentario |
| requiere_supervisor | BOOLEAN | Solo supervisor puede ejecutar esta transicion |
| activo | BOOLEAN | |

**Ejemplo de transiciones:**

| Origen | Destino | Accion | Nota | Supervisor |
|--------|---------|--------|------|------------|
| Asignado | Contactado | Marcar contactado | Si | No |
| Asignado | No contactado | No se logro contactar | Si | No |
| Contactado | Interesado | Cliente interesado | Si | No |
| Contactado | No interesado | Cliente no interesado | Si | No |
| Interesado | Negociacion | Iniciar negociacion | Si | No |
| Interesado | No interesado | Perdio interes | Si | No |
| Negociacion | Venta | Registrar venta | Si | No |
| Negociacion | Negociacion caida | Negociacion fallida | Si | No |
| No contactado | Pool | Devolver al pool | No | Si |
| No interesado | Interesado | Retomar cliente | Si | Si |
| No interesado | Pool | Devolver al pool | No | Si |
| Negociacion caida | Interesado | Retomar cliente | Si | Si |
| Negociacion caida | Pool | Devolver al pool | No | Si |

### 5. Oportunidades (centro del sistema)

#### `oportunidades`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| cliente_id | INT | Referencia a clientes.id en BD Clientes |
| usuario_id | INT FK → usuarios | Promotor asignado actualmente |
| etapa_id | INT FK → embudo_etapas | Estado actual en el embudo |
| origen | VARCHAR(20) | POOL, CAPTACION, REASIGNACION |
| lote_id | INT FK → lotes (nullable) | Si vino de asignacion masiva |
| timer_vence | TIMESTAMP (nullable) | Cuando vence el timer de la etapa actual |
| num_operacion | VARCHAR(100) (nullable) | Numero de operacion (solo para ventas) |
| venta_validada | BOOLEAN DEFAULT FALSE | Si el sistema externo confirmo la venta |
| activo | BOOLEAN | FALSE si regreso al pool |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Reglas:**
- Un cliente puede tener multiples oportunidades (una por cada vez que se asigna/capta)
- Solo una oportunidad activa por promotor-cliente
- Cuando regresa al pool, `activo = FALSE` y se crea nueva oportunidad al reasignar
- El `timer_vence` se recalcula cada vez que cambia de etapa

#### `lotes`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| usuario_id | INT FK → usuarios | Promotor que solicito |
| fecha | DATE | |
| cantidad | INT | Registros asignados |
| created_at | TIMESTAMP | |

**Nota:** Reemplaza la tabla `asignaciones` actual. Los lotes solo son el mecanismo de asignacion masiva. La vida del dato la maneja `oportunidades`.

### 6. Datos de contacto editados

#### `datos_contacto`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| cliente_id | INT | Referencia a clientes.id en BD Clientes |
| campo | VARCHAR(50) | tel_1, curp, rfc, num_empleado, etc. |
| valor | TEXT | Valor ingresado/editado |
| editado_por | INT FK → usuarios | Quien lo modifico |
| created_at | TIMESTAMP | |

**Notas:**
- La BD Clientes no se modifica. Las ediciones se guardan aqui.
- Al consultar un cliente, el sistema hace merge: datos originales + ediciones.
- Se mantiene historial de todas las ediciones (no se sobreescribe, se agrega).

### 7. Historial e interacciones

#### `historial`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| oportunidad_id | INT FK → oportunidades | |
| usuario_id | INT FK → usuarios | Quien ejecuto la accion |
| tipo | VARCHAR(30) | CAMBIO_ETAPA, NOTA, LLAMADA, WHATSAPP, SMS, CALIFICACION, ASIGNACION, REASIGNACION, CAPTACION |
| etapa_anterior_id | INT FK → embudo_etapas (nullable) | Para cambios de etapa |
| etapa_nueva_id | INT FK → embudo_etapas (nullable) | Para cambios de etapa |
| canal | VARCHAR(20) (nullable) | LLAMADA, WHATSAPP, SMS (para contactaciones) |
| nota | TEXT (nullable) | Comentario del usuario |
| created_at | TIMESTAMP | |

**Visibilidad:**
- Promotor: solo ve historial de SUS oportunidades
- Supervisor+: ve historial completo del cliente (todas las oportunidades)

### 8. Calificacion

#### `calificaciones`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| cliente_id | INT | Referencia a clientes.id |
| usuario_id | INT FK → usuarios | Quien califico (supervisor o promotor) |
| estado | VARCHAR(20) | CALIFICADO, NO_CALIFICABLE, PENDIENTE |
| notas | TEXT (nullable) | |
| created_at | TIMESTAMP | |

**Notas:**
- Supervisor califica datos del pool antes de asignar (convenios de su sucursal)
- Promotor califica cartera propia (obligatorio, no puede dejar sin calificar)
- Los datos calificados como NO_CALIFICABLE se guardan pero no se asignan

### 9. Captacion

#### `captaciones`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| oportunidad_id | INT FK → oportunidades | Oportunidad que se creo |
| usuario_id | INT FK → usuarios | Promotor que capto |
| origen_captacion | VARCHAR(50) | CAMBACEO, REFERIDO, REDES_SOCIALES, OTRO |
| convenio | VARCHAR(300) | Convenio del prospecto |
| datos_json | JSONB | Datos capturados (nombre, tel, curp, etc.) |
| created_at | TIMESTAMP | |

**Notas:**
- Los datos minimos obligatorios dependen del convenio (configurable)
- El sistema detecta duplicados por NSS/CURP/RFC y crea oportunidad nueva
- Timer de captacion mas tolerante que el del pool
- Si el promotor se va, sus captaciones pasan al supervisor

### 10. Reglas de convenio

#### `convenio_reglas`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| convenio | VARCHAR(300) | Nombre del convenio |
| campo | VARCHAR(50) | Ej: "curp", "nss", "rfc", "num_empleado" |
| obligatorio | BOOLEAN | Si es requerido para captar en este convenio |

**Ejemplo:**

| Convenio | Campo | Obligatorio |
|----------|-------|-------------|
| IMSS Pensionado | nss | Si |
| IMSS Pensionado | curp | Si |
| IMSS Pensionado | rfc | No |
| Compilado Cartera | rfc | Si |
| Compilado Cartera | nss | No |

### 11. Ventas y validacion

#### `ventas`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| oportunidad_id | INT FK → oportunidades | |
| usuario_id | INT FK → usuarios | Promotor que registro la venta |
| num_operacion | VARCHAR(100) | Numero de operacion ingresado por el promotor |
| cliente_rfc | VARCHAR(20) | RFC para match con sistema externo |
| validada | BOOLEAN DEFAULT FALSE | Match confirmado con sistema externo |
| fecha_validacion | TIMESTAMP (nullable) | Cuando se valido |
| created_at | TIMESTAMP | |

**Flujo:**
1. Promotor marca venta → Confetti → Ingresa num_operacion
2. Se crea registro con `validada = FALSE`
3. Sistema externo valida por RFC o num_operacion (async)
4. Si match → `validada = TRUE`, indicador visual en UI

### 12. Configuracion general

#### `configuracion`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | SERIAL PK | |
| clave | VARCHAR(100) UNIQUE | |
| valor | TEXT | |

**Claves iniciales:**

| Clave | Valor | Descripcion |
|-------|-------|-------------|
| max_registros_por_dia | 300 | Maximo asignacion diaria por promotor |
| timer_captacion_horas | 168 | Timer para datos captados (7 dias) |

---

## Flujos principales

### Flujo 1: Asignacion desde pool

```
1. Promotor solicita datos
2. Sistema verifica:
   - Limite diario no alcanzado
   - Plan de trabajo de su sucursal (convenios permitidos)
3. Selecciona datos del pool:
   - Solo convenios del plan de trabajo
   - Solo datos calificados (o sin calificar si es cartera/promotor)
   - Que no tengan oportunidad activa
4. Crea lote + oportunidades (una por cada dato)
5. Cada oportunidad inicia en etapa "Asignado" con timer
```

### Flujo 2: Trabajo del promotor

```
1. Promotor ve sus oportunidades activas
2. Selecciona un cliente → ve datos + historial propio
3. Contacta por llamada o WhatsApp/SMS
4. Registra resultado:
   - Selecciona accion (ej: "Marcar contactado")
   - Selecciona canal (Llamada, WhatsApp, SMS)
   - Escribe nota obligatoria
5. Oportunidad cambia de etapa
6. Timer se reinicia segun nueva etapa
```

### Flujo 3: Salida del embudo (supervisor)

```
1. Promotor marca "No interesado" (con nota)
2. Oportunidad aparece en bandeja del supervisor
3. Supervisor revisa historial completo
4. Opciones:
   a) Retomar: cambia a "Interesado", aplica su experiencia
   b) Devolver al pool: oportunidad se desactiva, dato disponible
5. Si devuelve al pool y otro promotor lo recibe:
   → Se crea NUEVA oportunidad (historial anterior solo visible supervisor+)
```

### Flujo 4: Timer vencido

```
1. Timer de oportunidad vence
2. Sistema automaticamente:
   - Oportunidad se desactiva
   - Dato regresa al pool
   - Notificacion al promotor: "X datos vencidos"
   - Notificacion al supervisor: detalle de que datos y de quien
3. No hay rollback
```

### Flujo 5: Baja de promotor

```
1. Admin/supervisor desactiva promotor
2. TODAS sus oportunidades activas:
   - Se transfieren al supervisor del equipo
   - Historial se mantiene
3. Supervisor redistribuye manualmente entre su equipo
   - Cada reasignacion crea nueva oportunidad
```

### Flujo 6: Venta

```
1. Promotor en etapa "Negociacion" selecciona "Registrar venta"
2. Ingresa numero de operacion
3. Sistema:
   - Muestra Confetti
   - Crea registro en tabla ventas
   - Oportunidad pasa a etapa "Venta"
4. Validacion asincrona:
   - Sistema compara RFC o num_operacion con sistema externo
   - Si match: marca validada = TRUE, indicador verde en UI
   - Si no match: permanece como "Pendiente validacion"
```

### Flujo 7: Captacion

```
1. Promotor va a "Captar cliente"
2. Selecciona convenio
3. Sistema muestra campos obligatorios segun convenio
4. Promotor llena datos
5. Sistema verifica duplicados (NSS/CURP/RFC):
   - Si existe: crea NUEVA oportunidad vinculada al mismo cliente
   - Si no existe: crea nuevo registro en datos_contacto + nueva oportunidad
6. Oportunidad se asigna automaticamente al promotor
7. Timer de captacion (mas tolerante)
8. Entra al embudo normalmente
```

### Flujo 8: Calificacion

```
Supervisor:
1. Toma lote del pool (convenios de su sucursal)
2. Para cada dato:
   - Consulta portales externos (IMSS, RENAPO, etc.)
   - Agrega/verifica: CURP, RFC, num_empleado, telefonos
   - Marca: CALIFICADO / NO_CALIFICABLE / PENDIENTE
3. Datos calificados quedan disponibles para asignacion

Promotor (cartera propia):
1. Recibe datos sin calificar
2. Debe calificar TODOS (obligatorio)
3. Mismo proceso pero no puede dejar pendientes
```

---

## Jerarquia de visibilidad

| Rol | Ve | Puede hacer |
|-----|-----|-------------|
| **Promotor** | Sus oportunidades, su historial | Trabajar embudo, captar, editar datos |
| **Supervisor** | Todo su equipo, historial completo de clientes | Todo lo del promotor + calificar, reasignar, retomar, redistribuir |
| **Gerente Sucursal** | Todos los equipos de su sucursal | Visualizar metricas, gestionar equipos |
| **Gerente Regional** | Todas las sucursales de su region | Todo lo anterior + plan de trabajo, gestionar sucursales |
| **Admin** | Todo el sistema | Configurar embudo, convenios, reglas, crear usuarios, todo |

---

## Metricas (tablas simples)

### Tabla Supervisor: Mi equipo

| Promotor | Asignados | Contactados | Interesados | Negociacion | Ventas | Vencidos | Captados |
|----------|-----------|-------------|-------------|-------------|--------|----------|----------|
| Juan | 300 | 180 | 45 | 12 | 3 | 8 | 5 |
| Maria | 280 | 210 | 60 | 18 | 7 | 2 | 12 |
| **Total** | **580** | **390** | **105** | **30** | **10** | **10** | **17** |

### Tabla Gerente Sucursal: Mis equipos

| Equipo | Supervisor | Asignados | Contactados | Ventas | Captados | % Conv. |
|--------|-----------|-----------|-------------|--------|----------|---------|
| Equipo 1 | Carlos | 580 | 390 | 10 | 17 | 1.72% |
| Equipo 2 | Ana | 750 | 480 | 15 | 22 | 2.00% |

### Tabla Gerente Regional: Mis sucursales

| Sucursal | Asignados | Ventas | Captados | Validadas | % Conv. |
|----------|-----------|--------|----------|-----------|---------|
| Monterrey | 1,330 | 25 | 39 | 20 | 1.88% |
| CDMX | 2,100 | 38 | 80 | 30 | 1.81% |

---

## Fases de implementacion

### Fase 1: Base solida
- Separar BD Clientes / BD Sistema
- Sistema de asignacion perfeccionado con plan de trabajo
- Organizacion (regiones, zonas, sucursales, equipos)
- Roles basicos funcionando (admin, promotor, supervisor)
- Edicion de datos de contacto en BD Sistema (no tocar BD Clientes)

### Fase 2: Embudo de ventas
- Etapas configurables por admin
- Transiciones con reglas (nota obligatoria, requiere supervisor)
- Timers por etapa con auto-vencimiento
- Historial de interacciones (timeline)
- Canales de contacto (llamada, WhatsApp, SMS)
- Registro de ventas con confetti y num_operacion
- Validacion asincrona de ventas

### Fase 3: Roles superiores
- Gerente sucursal y gerente regional
- Vistas de metricas (tablas con numeros)
- Plan de trabajo por gerente regional
- Visibilidad jerarquica del historial

### Fase 4: Flujos avanzados
- Bandeja del supervisor (datos en etapas de salida)
- Retomar clientes (supervisor → interesado)
- Reasignacion y redistribucion
- Baja de promotor → transferencia al supervisor
- Calificacion de datos (supervisor y promotor)

### Fase 5: Captacion
- Formulario de captacion con campos por convenio
- Deteccion de duplicados
- Oportunidades de captacion en el embudo
- Timers diferenciados para captacion



 