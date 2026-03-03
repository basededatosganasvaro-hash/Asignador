# Design System — Bot Multiconvenio Admin Panel

Especificaciones CSS/UI para replicar este diseño en otros proyectos.

---

## 1. Setup

- **Framework:** Vue 3 (Composition API) + Vite
- **CSS:** Tailwind CSS (via CDN `https://cdn.tailwindcss.com`) con config inline en `index.html`
- **Sin** PostCSS ni `tailwind.config.js` separado

### Fuentes (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
```

| Rol | Familia | Pesos |
|---|---|---|
| `font-display` (títulos, stats) | Plus Jakarta Sans | 500, 600, 700, 800 |
| `font-body` (default) | Inter | 400, 500, 600 |
| `font-mono` (IDs, RFCs, código) | JetBrains Mono | 400 |

---

## 2. Tailwind Config

```js
tailwind.config = {
  theme: {
    extend: {
      colors: {
        base:            '#0B0F1A',   // Fondo de página
        surface:         '#131825',   // Cards, tablas, paneles
        'surface-hover': '#1A2035',   // Hover en filas, items de lista
        elevated:        '#1E2538',   // Modales, dropdowns
        sidebar:         '#080C15',   // Sidebar (más oscuro)
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-in':  'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
}
```

---

## 3. CSS Global

```css
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: #0B0F1A;
  background-image: radial-gradient(
    ellipse at 50% 0%,
    rgba(245,158,11,0.03) 0%,
    transparent 60%
  );
}

/* Scrollbars */
::-webkit-scrollbar       { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.5); }

/* Selección de texto */
::selection { background: rgba(245,158,11,0.25); color: #f1f5f9; }

/* Transiciones de página (Vue router) */
.page-enter-active { animation: slideUp 0.3s ease-out; }
.page-leave-active { animation: fadeIn 0.15s ease-in reverse; }

/* Efecto glow en cards */
.card-glow {
  position: relative;
  transition: box-shadow 0.3s ease;
}
.card-glow:hover {
  box-shadow: 0 0 0 1px rgba(245,158,11,0.1), 0 4px 20px rgba(0,0,0,0.3);
}

/* Scrollbar delgado para tablas */
.scrollbar-thin::-webkit-scrollbar       { height: 8px; }
.scrollbar-thin::-webkit-scrollbar-track { background: #1e293b; border-radius: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #475569; }

[v-cloak] { display: none; }
```

---

## 4. Paleta de Colores

### Capas de fondo (oscuro → claro)

| Token | Hex | Uso |
|---|---|---|
| `sidebar` | `#080C15` | Sidebar |
| `base` | `#0B0F1A` | Fondo de página |
| `surface` | `#131825` | Cards, tablas |
| `surface-hover` | `#1A2035` | Hover en filas |
| `elevated` | `#1E2538` | Modales |

### Escala Slate (Tailwind default, uso frecuente)

| Clase | Uso |
|---|---|
| `slate-100` | Encabezados, valores importantes |
| `slate-200` | Texto primario en tablas |
| `slate-300` | Texto semi-prominente |
| `slate-400` | Texto body, labels, datos de tabla |
| `slate-500` | Texto secundario, placeholders |
| `slate-600` | Texto muted, iconos placeholder |
| `slate-700` | Bordes de inputs |
| `slate-800/40..50` | Fondos de inputs, headers de tabla |

### Color de marca

| Clase | Hex | Uso |
|---|---|---|
| `amber-500` | `#f59e0b` | CTAs, nav activo, badges, spinner, logo |
| `amber-400` | `#fbbf24` | Hover de botones primarios |
| `amber-600` | `#d97706` | Gradiente del logo |

### Colores semánticos (badges/estados)

| Color | Uso |
|---|---|
| `green` | Aprobado, comprado, éxito |
| `yellow` | Incidencia, warning, pendiente |
| `blue` | En proceso, info, supervisores |
| `purple` | Admin, tubería, permisos |
| `red` | Cancelado, rechazado, error, destructivo |
| `teal` | Autorizado, gestor crédito |
| `orange` | Gerente operativo, políticas internas |
| `slate` | Agente, nuevo, neutral |
| `emerald` | Comprado (alternativo) |

---

## 5. Componentes

### 5.1 Botones

**Primario (amber):**
```html
<button class="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950
               text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors
               shadow-lg shadow-amber-500/20">
```

**Secundario:**
```html
<button class="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50
               border border-slate-700 text-slate-300 text-sm font-medium
               rounded-lg hover:bg-slate-800 transition-colors">
```

**Cancelar / texto:**
```html
<button class="px-4 py-2 text-sm text-slate-400 border border-slate-700
               rounded-lg hover:bg-surface-hover transition-colors">
```

**Danger:**
```html
<button class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg
               hover:bg-red-500 font-medium transition-colors
               shadow-lg shadow-red-600/20">
```

**Outline (variantes de color para acciones en tabla):**
```html
<!-- Patrón: border-{color}-500/30 text-{color}-400 hover:bg-{color}-500/10 -->
<button class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-blue-500/30
               text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/10 transition-colors">
```

**Submit full-width:**
```html
<button class="w-full py-2.5 bg-amber-500 text-slate-950 rounded-lg font-semibold
               hover:bg-amber-400 disabled:opacity-50 transition-all duration-150
               flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
```

### 5.2 Modales

**Overlay:**
```html
<div class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
```

**Contenedor:**
```html
<div class="fixed inset-0 z-[90] flex items-center justify-center">
```

**Panel del modal:**
```html
<div class="bg-elevated rounded-2xl border border-slate-700/60 shadow-2xl
            shadow-black/50 w-full max-w-2xl relative z-10 max-h-[85vh] overflow-y-auto">
```

**Header sticky:**
```html
<div class="sticky top-0 bg-elevated border-b border-slate-800/40 px-6 py-4
            flex justify-between items-center rounded-t-2xl">
```

**Footer sticky:**
```html
<div class="sticky bottom-0 bg-surface border-t border-slate-800/40 px-6 py-3
            flex justify-end gap-2 rounded-b-2xl">
```

**Bloquear scroll de fondo (JS):**
```js
// Al abrir modal
document.body.style.overflow = 'hidden'
// Al cerrar modal
document.body.style.overflow = ''
```

### 5.3 Cards

**Card estándar:**
```html
<div class="bg-surface rounded-xl border border-slate-800/60 p-5">
```

**Stats card con glow:**
```html
<div class="bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden card-glow">
  <!-- Barra gradiente superior -->
  <div class="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-{color}-500 to-{color}-600"></div>
  <!-- Label -->
  <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Label</span>
  <!-- Icono -->
  <span class="w-10 h-10 rounded-lg flex items-center justify-center
               bg-{color}-500/10 text-{color}-400 ring-1 ring-{color}-500/20">
  <!-- Valor -->
  <p class="font-display text-3xl font-extrabold text-slate-100">42</p>
</div>
```

**Card con footer de acciones:**
```html
<div class="bg-surface rounded-xl border border-slate-800/60 overflow-hidden">
  <div class="p-5"><!-- contenido --></div>
  <div class="border-t border-slate-800/40 px-5 py-3 bg-slate-900/30 flex items-center justify-end gap-2">
    <!-- botones -->
  </div>
</div>
```

### 5.4 Tablas

```html
<div class="bg-surface rounded-xl border border-slate-800/60 overflow-hidden">
  <table class="w-full text-sm">
    <thead class="bg-slate-800/40 border-b border-slate-800/40">
      <tr>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Columna
        </th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-800/40">
      <tr class="hover:bg-surface-hover transition-colors">
        <td class="px-4 py-3 font-mono text-xs text-slate-500">#1</td>
        <td class="px-4 py-3 font-medium text-slate-100">Nombre</td>
        <td class="px-4 py-3 text-slate-400">Secundario</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Estado vacío:**
```html
<div class="py-16 text-center">
  <svg class="w-12 h-12 text-slate-700 mx-auto mb-3">...</svg>
  <p class="text-slate-500 text-sm">No hay datos</p>
</div>
```

### 5.5 Badges / Pills

**Patrón universal:** `bg-{color}-500/15 text-{color}-400 ring-1 ring-{color}-500/30`

```html
<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
             bg-green-500/15 text-green-400 ring-1 ring-green-500/30">
  Aprobado
</span>
```

**Mapeo de roles:**
```
admin            → purple
supervisor       → blue
gestor           → green
gestor_credito   → teal
agente           → slate
gerente_operativo → orange
```

**Mapeo de estados (procesos):**
```
NUEVO              → slate
EN PROCESO         → blue
INCIDENCIA         → yellow
RECHAZADO          → red
TUBERIA            → purple
RECUPERADA         → green
COMPRADA           → emerald
AUTORIZADA         → teal
POLITICAS INTERNAS → orange
```

### 5.6 Inputs

**Input de texto:**
```html
<input class="w-full px-3 py-2 bg-slate-800/50 border border-slate-700
              text-slate-200 placeholder-slate-600 rounded-lg text-sm
              focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60
              outline-none transition-all" />
```

**Input con icono:**
```html
<div class="relative">
  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
    <svg class="w-4 h-4 text-slate-600">...</svg>
  </div>
  <input class="w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-700
                text-slate-200 placeholder-slate-600 rounded-lg text-sm
                focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60
                outline-none transition-all" />
</div>
```

**Select:**
```html
<select class="px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-200
               rounded-lg text-sm focus:ring-2 focus:ring-amber-500/40
               focus:border-amber-500/60 outline-none">
```

**Label:**
```html
<label class="block text-sm font-medium text-slate-300 mb-1">Label</label>
```

**Error:**
```html
<div class="flex items-center gap-2 text-red-400 text-sm
            bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
```

**Drop zone (archivos):**
```html
<div class="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center">
  <svg class="w-10 h-10 text-slate-700 mx-auto mb-3">...</svg>
  <p class="text-sm text-slate-500 mb-3">Arrastra tu archivo aquí</p>
</div>
```

### 5.7 Sidebar

```html
<aside class="fixed left-0 top-0 h-full bg-sidebar text-white flex flex-col z-50
              shadow-2xl shadow-black/40 transition-all duration-300 ease-in-out
              border-r border-slate-800/50"
       :class="collapsed ? 'w-[72px]' : 'w-64'">
```

**Nav link activo:**
```html
<a class="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
          bg-amber-500/10 text-amber-400">
  <!-- Indicador lateral derecho -->
  <div class="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-500 rounded-l"></div>
</a>
```

**Nav link inactivo:**
```html
<a class="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
          text-slate-500 hover:bg-slate-800/50 hover:text-slate-300 transition-all duration-150">
```

**Logo badge:**
```html
<div class="w-9 h-9 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg
            flex items-center justify-center font-bold text-sm text-slate-950
            shadow-lg shadow-amber-500/20">
  BM
</div>
```

### 5.8 Topbar

```html
<header class="sticky top-0 z-40 bg-surface/80 backdrop-blur-md
               border-b border-slate-800/60 px-8 py-4">
  <h2 class="font-display text-xl font-bold text-slate-100">Título</h2>
</header>
```

### 5.9 Tabs

**Tab container:**
```html
<div class="flex gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-800/40">
```

**Tab activo:**
```html
<button class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
               font-semibold bg-surface shadow-sm text-amber-400 transition-all whitespace-nowrap">
```

**Tab inactivo:**
```html
<button class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
               font-medium text-slate-500 hover:text-slate-300 transition-all whitespace-nowrap">
```

### 5.10 Toasts

```html
<!-- Contenedor: fixed top-4 right-4 z-[100] space-y-2 -->

<!-- Toast success -->
<div class="px-4 py-3 rounded-xl shadow-lg shadow-black/20 text-sm max-w-sm
            flex items-center gap-3 backdrop-blur-lg
            bg-green-500/15 border border-green-500/30 text-green-300">

<!-- Toast error -->
<div class="... bg-red-500/15 border border-red-500/30 text-red-300">

<!-- Toast info -->
<div class="... bg-blue-500/15 border border-blue-500/30 text-blue-300">
```

**Transición:**
```css
.fade-enter-active, .fade-leave-active { transition: all 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateX(30px); }
```

### 5.11 Spinner / Loading

```html
<!-- Grande (estado de carga) -->
<svg class="animate-spin w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
</svg>

<!-- Pequeño (dentro de botón) -->
<svg class="animate-spin w-4 h-4" ...>
```

### 5.12 Avatares

```html
<!-- Avatar con inicial -->
<div class="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
  <span class="text-xs font-semibold text-blue-400">A</span>
</div>

<!-- Avatar genérico -->
<div class="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center ring-1 ring-slate-700">
  <svg class="w-4 h-4 text-slate-500"><!-- icono persona --></svg>
</div>
```

### 5.13 Paginación

```html
<div class="flex items-center justify-center gap-2 mt-4">
  <button class="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                 border border-slate-700 text-slate-300 rounded-lg
                 disabled:opacity-30 hover:bg-surface-hover transition-colors font-medium">
    Anterior
  </button>
  <span class="text-sm text-slate-500 px-3">Página 1 de 5</span>
  <button class="...">Siguiente</button>
</div>
```

### 5.14 Barra de progreso

```html
<div class="w-full bg-slate-800/60 rounded-full h-2">
  <div class="h-2 rounded-full transition-all duration-300 bg-green-500"
       style="width: 75%"></div>
</div>
<!-- Colores: bg-green-500 (<70%), bg-yellow-500 (70-90%), bg-red-500 (>90%) -->
```

### 5.15 Código inline

```html
<code class="bg-slate-800/60 px-2 py-0.5 rounded text-xs font-mono text-slate-300">
  VALOR
</code>
```

### 5.16 Bloque de texto preformateado

```html
<p class="bg-slate-800/40 border border-slate-800/60 rounded-lg p-3 text-sm
          whitespace-pre-wrap text-slate-300 max-h-48 overflow-y-auto">
  Contenido largo...
</p>
```

### 5.17 Alerta / indicador pendiente

```html
<div class="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
  <div class="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
  <span class="text-sm font-medium text-amber-400">3 pendientes</span>
</div>
```

---

## 6. Tipografía

| Uso | Clases |
|---|---|
| Título de página | `font-display text-xl font-bold text-slate-100` |
| Valor estadístico | `font-display text-3xl font-extrabold text-slate-100` |
| Título de modal/sección | `text-lg font-semibold text-slate-100` |
| Título de card | `font-semibold text-slate-100 text-sm` |
| Header de tabla | `text-xs font-semibold text-slate-400 uppercase tracking-wider` |
| Sub-header de sección | `text-xs font-semibold text-slate-500 uppercase tracking-wider` |
| Label de nav (sidebar) | `text-[10px] font-semibold text-slate-600 uppercase tracking-widest` |
| Texto body / datos | `text-sm text-slate-400` |
| Datos primarios tabla | `text-sm font-medium text-slate-100` |
| IDs monoespaciados | `font-mono text-xs text-slate-500` |
| Labels de form | `text-sm font-medium text-slate-300` |
| Texto helper | `text-xs text-slate-600` |
| Placeholder | `placeholder-slate-600` |

---

## 7. Espaciado y Border Radius

| Elemento | Radius | Padding |
|---|---|---|
| Cards, tablas | `rounded-xl` | `p-5` o `p-6` |
| Modales | `rounded-2xl` | `p-6` |
| Botones primarios | `rounded-lg` | `px-4 py-2` |
| Botones outline pequeños | `rounded-lg` | `px-2.5 py-1.5` |
| Badges | `rounded-full` | `px-2.5 py-1` |
| Inputs | `rounded-lg` | `px-3 py-2` |
| Tabs container | `rounded-xl` | `p-1` |
| Tabs botón | `rounded-lg` | `px-4 py-2.5` |
| Toasts | `rounded-xl` | `px-4 py-3` |
| Código inline | `rounded` | `px-2 py-0.5` |
| Padding de página | — | `p-8` |

---

## 8. Sombras

```
shadow-2xl shadow-black/40    — Sidebar
shadow-2xl shadow-black/50    — Modales
shadow-lg shadow-black/20     — Toasts
shadow-lg shadow-amber-500/20 — Botones primarios, logo
shadow-lg shadow-red-600/20   — Botones danger
```

---

## 9. Backdrop / Blur

```
backdrop-blur-sm   — Overlay de modales (bg-black/60)
backdrop-blur-md   — Topbar (bg-surface/80)
backdrop-blur-lg   — Toasts
```

---

## 10. Animaciones

| Nombre | Definición | Uso |
|---|---|---|
| `animate-fade-in` | opacity 0→1, 0.4s | Fade general |
| `animate-slide-up` | translateY(12px)→0 + opacity, 0.4s | Cards con stagger, entrada de página |
| `animate-scale-in` | scale(0.95)→1 + opacity, 0.2s | Apertura de modal |
| `animate-spin` | Tailwind built-in | Spinners |
| `animate-pulse` | Tailwind built-in | Punto de pendientes |
| `transition-colors` | Tailwind built-in | Hovers de botones/links |
| `transition-all duration-150` | — | Focus de inputs |
| `transition-all duration-300` | — | Sidebar collapse, card glow |

**Stagger en cards:**
```html
<div class="animate-slide-up" style="animation-delay: 0ms">
<div class="animate-slide-up" style="animation-delay: 60ms">
<div class="animate-slide-up" style="animation-delay: 120ms">
<!-- Incrementos de 60ms -->
```

---

## 11. Z-Index Stack

| Z-Index | Elemento |
|---|---|
| `z-40` | Topbar (sticky) |
| `z-50` | Sidebar (fixed) |
| `z-[90]` | Modales |
| `z-[100]` | Toasts |

---

## 12. Sidebar Dimensiones

| Estado | Ancho | Margin-left del contenido |
|---|---|---|
| Expandido | `w-64` (256px) | `256px` |
| Colapsado | `w-[72px]` | `72px` |

---

## 13. Grids Responsive

```
Stats:        grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3
Paneles info: grid-cols-1 lg:grid-cols-2 gap-4
Cards equipo: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5
Checkboxes:   grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2
```

---

## 14. Iconos

- Todos son SVG inline, `fill="none"`, `stroke="currentColor"`
- Nav icons: `w-5 h-5`, `stroke-width="1.75"`
- UI icons: `w-4 h-4` o `w-5 h-5`, `stroke-width="2"`
- Empty state: `w-12 h-12 text-slate-700`
- Section headers: `w-4 h-4` con color (`text-blue-400`, etc.)
