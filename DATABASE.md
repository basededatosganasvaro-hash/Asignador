# Especificaciones de Base de Datos

## Servidor

| Parametro | Valor |
|-----------|-------|
| Motor | PostgreSQL |
| Hosting | Railway |
| Base de datos | railway |
| Tablas | clientes, catalogo_estados, catalogo_convenios |

## Tabla: `clientes`

### Columnas de sistema

| # | Columna | Tipo | Descripcion |
|---|---------|------|-------------|
| 1 | id | SERIAL (PK) | Identificador unico autoincremental |
| 2 | tipo_cliente | VARCHAR(100) NOT NULL | Tipo de cliente detectado por nombre de archivo |
| 3 | fecha_carga | TIMESTAMP | Fecha y hora de carga del registro |
| 4 | archivo_origen | VARCHAR(500) | Nombre del archivo Excel de origen |

### Columnas de identificacion

| # | Columna | Tipo | Archivos que la usan |
|---|---------|------|----------------------|
| 5 | nss | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 6 | a_paterno | TEXT | Deprecada (siempre NULL, nombres unificados en "nombres") |
| 7 | a_materno | TEXT | Deprecada (siempre NULL, nombres unificados en "nombres") |
| 8 | nombres | TEXT | Todos - Nombre completo con apellidos (mapeado y concatenado automaticamente) |
| 9 | curp | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 10 | rfc | TEXT | Todos (mapeado desde "RFC", "RFC prospecto") |

### Columnas de datos personales

| # | Columna | Tipo | Archivos que la usan |
|---|---------|------|----------------------|
| 11 | edad | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 12 | genero | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 13 | tipo_pension | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 14 | mes_pension | TEXT | IMSS Pensionado |
| 15 | anio_pension | TEXT | IMSS Pensionado |

### Columnas de ubicacion

| # | Columna | Tipo | Archivos que la usan |
|---|---------|------|----------------------|
| 16 | umf_delegacion | TEXT | IMSS Pensionado |
| 17 | calle_num | TEXT | IMSS Pensionado |
| 18 | colonia | TEXT | IMSS Pensionado |
| 19 | domicilio_pensionados | TEXT | IMSS Pensionado |
| 20 | region | TEXT | IMSS Pensionado |
| 21 | estado | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 22 | municipio | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 23 | cp | TEXT | IMSS Pensionado |

### Columnas de contacto

| # | Columna | Tipo | Archivos que la usan |
|---|---------|------|----------------------|
| 24 | tel_1 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 25 | tipo_1 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 26 | tel_2 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 27 | tipo_2 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 28 | tel_3 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 29 | tipo_3 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 30 | tel_4 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 31 | tipo_4 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 32 | tel_5 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 33 | tipo_5 | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 34 | direccion_email | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |

### Columnas financieras

| # | Columna | Tipo | Archivos que la usan |
|---|---------|------|----------------------|
| 35 | creditos_actuales | TEXT | IMSS Pensionado |
| 36 | tipo_mercado | TEXT | IMSS Pensionado |
| 37 | tipo_cliente_original | TEXT | IMSS Pensionado |
| 38 | tipo_cliente_csp | TEXT | IMSS Pensionado |
| 39 | capacidad | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 40 | plazo_oferta | TEXT | IMSS Pensionado |
| 41 | oferta | TEXT | IMSS Pensionado, Maletin Exclientes, Maletin LCOM |
| 42 | cotizador | TEXT | IMSS Pensionado |
| 43 | tasa | TEXT | IMSS Pensionado |
| 44 | cat | TEXT | IMSS Pensionado |
| 45 | financiera | TEXT | IMSS Pensionado |
| 46 | plazo | TEXT | IMSS Pensionado |
| 47 | monto_solicitado | TEXT | IMSS Pensionado |
| 48 | descuento_actual | TEXT | IMSS Pensionado |
| 49 | plazo_transcurrido | TEXT | IMSS Pensionado |
| 50 | plazo_restante | TEXT | IMSS Pensionado |
| 51 | cat_actual | TEXT | IMSS Pensionado |
| 52 | tasa_actual | TEXT | IMSS Pensionado |

### Columnas de cartera y maletin

| # | Columna | Tipo | Archivos que la usan |
|---|---------|------|----------------------|
| 53 | convenio | TEXT | Compilado Cartera, Maletin Exclientes, Maletin LCOM |
| 54 | monto_comisionable | TEXT | Compilado Cartera |
| 55 | dependencia | TEXT | Maletin Exclientes, Maletin LCOM |
| 56 | estatus | TEXT | Maletin Exclientes, Maletin LCOM |
| 57 | monto | TEXT | Maletin Exclientes, Maletin LCOM |

**Total: 57 columnas** (4 de sistema + 53 de datos)

## Indice unico (deduplicacion)

```sql
CREATE UNIQUE INDEX idx_clientes_dedup
ON clientes (COALESCE(nss, ''), COALESCE(rfc, ''), tipo_cliente);
```

Los registros se consideran duplicados cuando coinciden en **NSS + RFC + tipo_cliente**. Se usa `COALESCE` para tratar NULLs como cadena vacia en la comparacion.

## Mapeo de columnas por archivo de origen

### IMSS Pensionado Nuevo (38 columnas → 38 mapeadas)

| Columna original | Columna normalizada |
|------------------|---------------------|
| NSS/Matricula | nss |
| A Paterno | a_paterno |
| A Materno | a_materno |
| Nombres | nombres |
| CURP | curp |
| RFC | rfc |
| Edad | edad |
| Genero | genero |
| Tipo Pension | tipo_pension |
| Mes Pension | mes_pension |
| Ano Pension | anio_pension |
| UMF/Delegacion | umf_delegacion |
| Calle Num | calle_num |
| Colonia | colonia |
| Domicilio Pensionados | domicilio_pensionados |
| Region | region |
| Estado | estado |
| Municipio | municipio |
| CP | cp |
| Tel 1 - Tel 5 | tel_1 - tel_5 |
| Tipo 1 - Tipo 5 | tipo_1 - tipo_5 |
| Direccion Email | direccion_email |
| Creditos actuales | creditos_actuales |
| Tipo Mercado | tipo_mercado |
| Tipo cliente | tipo_cliente_original |
| Tipo Cliente CSP | tipo_cliente_csp |
| Capacidad | capacidad |
| Plazo oferta | plazo_oferta |
| Oferta | oferta |
| Cotizador | cotizador |
| Tasa | tasa |
| CAT | cat |
| Financiera | financiera |
| Plazo | plazo |
| Monto Solicitado | monto_solicitado |
| Descuento actual | descuento_actual |
| Plazo Transcurrido | plazo_transcurrido |
| Plazo restante | plazo_restante |
| CAT Actual | cat_actual |
| Tasa Actual | tasa_actual |

### Compilado de Cartera (4 columnas → 4 mapeadas)

| Columna original | Columna normalizada |
|------------------|---------------------|
| nombre | nombres |
| RFC | rfc |
| convenio | convenio |
| monto_comisionable | monto_comisionable |

### Mi Maletin Exclientes (26 columnas → 26 mapeadas)

| Columna original | Columna normalizada |
|------------------|---------------------|
| NSS | nss |
| Nombre prospecto | nombres |
| CURP | curp |
| RFC prospecto | rfc |
| Convenio | convenio |
| Dependencia | dependencia |
| Estatus | estatus |
| Monto | monto |
| Edad | edad |
| Genero | genero |
| Tipo Pension | tipo_pension |
| Estado | estado |
| Municipio | municipio |
| Tel 1 - Tel 5 | tel_1 - tel_5 |
| Tipo 1 - Tipo 5 | tipo_1 - tipo_5 |
| Direccion Email | direccion_email |
| Capacidad | capacidad |
| Oferta | oferta |

### Mi Maletin Nuevos LCOM (26 columnas → 26 mapeadas)

Mismo mapeo que Maletin Exclientes.

## Comportamiento con columnas extra

Si un archivo contiene columnas que no estan en el mapeo:
1. Se normalizan a snake_case automaticamente
2. Se agregan a la tabla con `ALTER TABLE ADD COLUMN`
3. Registros anteriores tendran NULL en esas columnas nuevas

## Deteccion automatica de tipo de cliente

| Palabras clave en nombre de archivo | Tipo asignado |
|--------------------------------------|---------------|
| "pensionado" o "imss" | IMSS Pensionado Nuevo |
| "compilado" o "cartera" | Compilado Cartera |
| "excliente" | Maletin Exclientes |
| "lcom" | Maletin Nuevos LCOM |

## Tabla: `catalogo_estados`

Catalogo de los 32 estados de Mexico con metadata para filtros.

| # | Columna | Tipo | Descripcion |
|---|---------|------|-------------|
| 1 | id | SERIAL (PK) | Identificador unico |
| 2 | nombre | VARCHAR(100) UNIQUE NOT NULL | Nombre oficial del estado con acentos |
| 3 | abreviatura | VARCHAR(10) | Abreviatura (CDMX, NL, EDOMEX, etc.) |
| 4 | region | VARCHAR(50) | Region geografica (Centro, Noreste, Noroeste, Occidente, Sur, Sureste) |
| 5 | activo | BOOLEAN DEFAULT TRUE | Flag para activar/desactivar estado en filtros |

### Regiones

| Region | Estados |
|--------|---------|
| Centro | Aguascalientes, Ciudad de Mexico, Estado de Mexico, Guanajuato, Hidalgo, Morelos, Puebla, Queretaro, San Luis Potosi, Tlaxcala, Zacatecas |
| Noreste | Coahuila, Nuevo Leon, Tamaulipas |
| Noroeste | Baja California, Baja California Sur, Chihuahua, Durango, Sinaloa, Sonora |
| Occidente | Colima, Jalisco, Michoacan, Nayarit |
| Sur | Guerrero, Oaxaca |
| Sureste | Campeche, Chiapas, Quintana Roo, Tabasco, Veracruz, Yucatan |

## Tabla: `catalogo_convenios`

Catalogo de los 336 convenios cargados con metadata.

| # | Columna | Tipo | Descripcion |
|---|---------|------|-------------|
| 1 | id | SERIAL (PK) | Identificador unico |
| 2 | nombre | VARCHAR(300) UNIQUE NOT NULL | Nombre del convenio |
| 3 | tipo_cliente | VARCHAR(100) | Tipo de cliente predominante asociado al convenio |
| 4 | total_registros | INTEGER DEFAULT 0 | Cantidad de registros en tabla clientes con este convenio |
| 5 | activo | BOOLEAN DEFAULT TRUE | Flag para activar/desactivar convenio en filtros |

## Normalizaciones aplicadas

### Nombres
- Las columnas `a_paterno` y `a_materno` se concatenan automaticamente en `nombres`
- Formato final: "NOMBRE APATERNO AMATERNO" (ej: "OBED PALAFOX HERRERA")
- Aplica tanto a datos existentes como a cargas futuras

### Estados
- Normalizados a 32 valores unicos con nombre oficial y acentos
- Corregidos: mayusculas/minusculas, espacios extra, municipios mal capturados como estados
- Ejemplos: "MEXICO" → "Estado de Mexico", "Huehuetoca" → "Estado de Mexico", "Silao" → "Guanajuato"
