# V4 Twilight — Guía de lenguaje visual

Documento de inspiración para construir una app nueva que comparta la identidad visual de V4 Twilight. **No es una guía de migración** — es la descripción del lenguaje (paleta, tipografía, layout, componentes, dark mode) para aplicarlo a cualquier producto, con cualquier set de páginas.

---

## 1. Filosofía

**Twilight** = el momento entre día y noche. Indigo profundo + violeta suave + slates fríos. Sensación: **calma trabajando**, no estridente. Pensada para herramientas internas que se usan muchas horas seguidas — debe descansar la vista, no competir por atención.

Tres principios:

1. **Dark mode al mismo nivel que light.** No es un afterthought. Los contrastes están tuneados a AAA y los slates son tintados, nunca negro puro.
2. **Un solo eje cromático fuerte (indigo) + un acento (violeta).** Todo lo demás es slate neutro. Los colores semánticos (success/danger/warning/info) son secundarios y solo aparecen cuando comunican algo.
3. **Layout estable, foco en el contenido.** Sidebar lateral angosto + topbar compacta + lienzo grande. Nada flota, nada distrae.

---

## 2. Paleta

### Marca

| Token             | Light       | Dark        | Uso                                |
| ----------------- | ----------- | ----------- | ---------------------------------- |
| `--primary`       | `#4F46E5`   | `#818CF8`   | Acciones, links, focus, activo     |
| `--primary-strong`| `#4338CA`   | `#A5B4FC`   | Hover de primary                   |
| `--primary-soft`  | `#EEF2FF`   | rgba 14%    | Backgrounds suaves de primary      |
| `--primary-line`  | `#C7D2FE`   | rgba 32%    | Bordes de elementos primary        |
| `--accent`        | `#8B5CF6`   | `#A78BFA`   | Highlights, save bars, tags        |
| `--accent-hover`  | `#7C3AED`   | `#C4B5FD`   | Hover de accent                    |

> Indigo manda en CTAs y navegación. Violeta aparece en momentos puntuales (CTA importante, brand mark, chip especial). Nunca los uses al mismo tiempo en el mismo elemento.

### Neutros (slate, fríos)

| Token             | Light       | Dark        | Uso                                |
| ----------------- | ----------- | ----------- | ---------------------------------- |
| `--bg`            | `#f8fafc`   | `#0B0F1A`   | Canvas de la página                |
| `--surface`       | `#ffffff`   | `#141925`   | Cards, paneles                     |
| `--surface-muted` | `#f1f5f9`   | `#1C2230`   | Hover, alternados, inputs          |
| `--surface-strong`| `#e2e8f0`   | `#262D3E`   | Elevados, popovers                 |
| `--ink`           | `#0f172a`   | `#F5F7FB`   | Títulos, body strong               |
| `--muted`         | `#64748b`   | `#A4B0C7`   | Body secundario (≥7:1 dark)        |
| `--subtle`        | `#94a3b8`   | `#7A8AA3`   | Body terciario                     |
| `--border`        | `#e2e8f0`   | `#2A3142`   | Borde por defecto                  |
| `--border-strong` | `#cbd5e1`   | `#3D465D`   | Borde enfatizado                   |

### Semánticos

| Token              | Light       | Dark        | Uso                                |
| ------------------ | ----------- | ----------- | ---------------------------------- |
| `--success`        | `#059669`   | `#34D399`   | Estado OK, confirmaciones          |
| `--success-soft`   | `#ECFDF5`   | rgba 14%    | Background success                 |
| `--danger`         | `#DC2626`   | `#F87171`   | Errores, destructivo               |
| `--danger-soft`    | `#FEE2E2`   | rgba 14%    | Background danger                  |
| `--warning`        | `#B45309`   | `#FBBF24`   | Atención, pendientes               |
| `--warning-soft`   | `#FFFBEB`   | rgba 12%    | Background warning                 |
| `--info`           | `#0284C7`   | `#38BDF8`   | Informativo, neutral               |
| `--info-soft`      | `#E0F2FE`   | rgba 14%    | Background info                    |

Cada semántico tiene su `-soft` (background suave) y `-line` (borde) para badges/banners.

### Sidebar (gradiente navy)

```css
--sidebar-bg-from: #1A1A2E;   /* light */
--sidebar-bg-to:   #0F1729;
--sidebar-glow:    rgba(79, 70, 229, 0.25);

/* dark mode — más profundo */
--sidebar-bg-from: #050810;
--sidebar-bg-to:   #080C18;
--sidebar-glow:    rgba(129, 140, 248, 0.22);
```

El sidebar mantiene el mismo gradiente oscuro en light y dark mode — es parte de la identidad. Solo se profundiza ligeramente en dark.

---

## 3. Tipografía

### Stack

```css
font-family: -apple-system, BlinkMacSystemFont,
             "SF Pro Text", "SF Pro Display",
             "Segoe UI", system-ui,
             "Helvetica Neue", Arial, sans-serif;
```

**Sin Google Fonts. Sin webfonts.** En macOS se ve SF Pro, en Windows Segoe UI, en Linux el system stack. Consistente con el OS, sin latencia, sin FOIT.

### Base

```css
html { font-size: 18px; }
```

Body inherits → 18px. Esto da una sensación generosa, cómoda para sesiones largas.

### Escala (px absolutos)

| Rol               | Tamaño   | Peso   | Notas                             |
| ----------------- | -------- | ------ | --------------------------------- |
| H1 página         | 28-32px  | 700    | letter-spacing -0.015em           |
| H2 sección        | 20-22px  | 600    | letter-spacing -0.01em            |
| H3 card / panel   | 16-17px  | 600-700| letter-spacing -0.005em           |
| Body              | 14-15px  | 400    | line-height 1.55                  |
| Body strong       | 14-15px  | 600    |                                   |
| Label / caption   | 12-13px  | 500    |                                   |
| Eyebrow           | 11px     | 600    | uppercase, tracking 0.08em        |

**Reglas:**

- Títulos en color sólido `var(--ink)`, **nunca con `background-clip: text`**. Se ve mal en pantalla a tamaños grandes.
- Tracking negativo solo en H1/H2. Por debajo de 16px tracking neutro.
- No bajar por debajo de 11px nunca.

---

## 4. Espaciado y radios

Sistema en múltiplos de 4:

```css
--s-1:  4px;   --s-6:  24px;
--s-2:  8px;   --s-7:  32px;
--s-3:  12px;  --s-8:  40px;
--s-4:  16px;  --s-9:  48px;
--s-5:  20px;  --s-10: 64px;
```

Radios generosos, no afilados:

```css
--r-sm:   6px;    /* chips, badges */
--r-md:   10px;   /* buttons, inputs */
--r-lg:   14px;   /* cards, panels */
--r-xl:   18px;   /* modales */
--r-2xl:  24px;   /* heroes */
--r-full: 999px;  /* pills, avatars */
```

> Ningún borde recto a 0px excepto separadores horizontales internos. La app debe sentirse suave, no afilada.

---

## 5. Sombras

Tintadas frías, no grises planos:

```css
/* Light */
--shadow-xs: 0 1px 0 rgba(15, 23, 42, 0.04);
--shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.06);
--shadow-md: 0 4px 16px rgba(15, 23, 42, 0.07), 0 1px 3px rgba(15, 23, 42, 0.04);
--shadow-lg: 0 16px 40px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06);

/* Dark — más oscuras, basadas en negro */
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.35);
--shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.40);
```

Focus ring siempre visible, nunca eliminado:

```css
--shadow-focus: 0 0 0 3px rgba(79, 70, 229, 0.20);
/* dark */ 0 0 0 3px rgba(129, 140, 248, 0.32);
```

---

## 6. Layout shell

### Estructura general

```
┌─────────────────────────────────────────┐
│  Sidebar  │  Topbar                     │
│  (gradi-  ├─────────────────────────────┤
│   ente,   │                             │
│   80px,   │      Content (canvas)       │
│   stick)  │                             │
│           │                             │
└───────────┴─────────────────────────────┘
```

- **Sidebar**: 80px, sticky a `top: 0`, alto `100vh`, gradiente navy de arriba a abajo
- **Topbar**: 76px de alto, sticky, separa con borde sutil
- **Content**: padding 24-32px, max-width opcional según vista

```css
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  min-height: 100vh;
}
```

### Sidebar

- Sólo íconos + label corto debajo (Phosphor regular, 22px)
- 6-8 items máximo en navegación principal
- Item activo: gradiente sutil indigo → violeta a 25/10% opacidad + borde inset blanco 1px
- Hover (no activo): `rgba(255,255,255,0.06)` background, texto blanco
- Brand mark al tope (gradiente violeta), botón de tema + avatar al pie
- Glow radial sutil arriba-izquierda (firma de la marca)

```css
.sidebar {
  background: linear-gradient(180deg, var(--sidebar-bg-from), var(--sidebar-bg-to));
  color: #f1f5f9;
  position: sticky; top: 0;
  height: 100vh;
  display: flex; flex-direction: column;
  padding: 18px 12px;
  gap: 12px;
  overflow: hidden;
}
.sidebar::after {
  content: "";
  position: absolute;
  top: -40px; left: -60px;
  width: 220px; height: 220px;
  background: radial-gradient(circle, var(--sidebar-glow), transparent 60%);
  pointer-events: none;
}
```

### Topbar

- Crumb / título a la izquierda (sin logo — el logo vive en el sidebar)
- Buscador grande en el centro/derecha (560px max, height 48px)
- Iconos de utilidad (ayuda, notificaciones) compactos (44×44)
- Sin shadow, solo border-bottom sutil

---

## 7. Componentes clave

### Brand mark

Cuadrado con gradiente violeta de 135°, bordes generosos:

```css
.brand-mark {
  width: 48px; height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #4F46E5 0%, #6366F1 60%, #8B5CF6 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
  display: grid; place-items: center;
}
```

### Cards / paneles

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
  padding: 24px;
}
```

Hover suave (lift de 1px) solo si la card es clickable. Si es estática, sin transformación.

### Botones

**Primary** — para CTA por vista:

```css
.btn-primary {
  background: var(--primary);
  color: var(--primary-fg);
  border: 0;
  border-radius: 10px;
  height: 40px; padding: 0 16px;
  font-weight: 600;
  transition: background 200ms ease;
}
.btn-primary:hover { background: var(--primary-strong); }
```

**Ghost** — secundarios, descartar, cancelar:

```css
.btn-ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.btn-ghost:hover { background: var(--surface-muted); }
```

**Accent** — solo cuando importa más que primary (save bar, confirmación destacada):

```css
.btn-accent {
  background: var(--accent);
  color: var(--accent-fg);
}
.btn-accent:hover { background: var(--accent-hover); }
```

### Badges / chips

Forma pill (`border-radius: 999px`), con `-soft` background y `-line` border:

```css
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  height: 22px; padding: 0 8px;
  border-radius: 999px;
  font-size: 12px; font-weight: 600;
  border: 1px solid;
}
.badge-success { background: var(--success-soft); color: var(--success); border-color: var(--success-line); }
.badge-danger  { background: var(--danger-soft);  color: var(--danger);  border-color: var(--danger-line); }
.badge-warning { background: var(--warning-soft); color: var(--warning); border-color: var(--warning-line); }
.badge-info    { background: var(--info-soft);    color: var(--info);    border-color: var(--info-line); }
```

### Inputs / select / textarea

```css
.input {
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  padding: 0 14px;
  font-size: 14px;
}
.input:focus {
  outline: 0;
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
}

[data-theme="dark"] .input { background: var(--surface-muted); }
```

### Save bar (sticky bottom, theme-aware)

Cuando una vista tiene cambios sin aplicar, una barra al pie:

```css
.save-bar {
  position: sticky; bottom: 18px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
  padding: 14px 20px;
  display: flex; gap: 16px; align-items: center;
}
[data-theme="dark"] .save-bar { background: var(--surface-muted); }
```

CTA principal en violeta (`btn-accent`), descartar en `btn-ghost`.

### Tabs

Tabs horizontales, indicador con underline sólido `var(--ink)` o pill `var(--primary)`:

```css
.tab {
  height: 40px;
  padding: 0 14px;
  color: var(--muted);
  font-weight: 500;
  border: 0;
  background: transparent;
}
.tab.is-active {
  color: var(--ink);
  box-shadow: inset 0 -2px 0 var(--ink);
}
```

### Modal / drawer

- Scrim: `rgba(15, 23, 42, 0.55)` light, `rgba(0, 0, 0, 0.65)` dark
- Modal: `--surface`, radio 18px, sombra `--shadow-lg`
- Drawer lateral: 480-650px, slide desde derecha, mismo background

---

## 8. Iconografía

**Phosphor Icons** (`@phosphor-icons/react` o `@phosphor-icons/web`).

- Peso por defecto: `regular`. Solo subir a `bold`/`fill` para destacar (estado activo, alertas críticas)
- Tamaños: 22px en sidebar, 17-18px en topbar/controles, 14-16px inline en cards
- **Nunca mezclar Phosphor con otra librería** (ni Lucide, ni Heroicons, ni Material Icons)
- Color hereda de `currentColor` siempre — no fijar `fill` a hex

Iconos clave del lenguaje:
- `Lightning` para acción/control
- `UsersThree` para gente
- `UserGear` para equipo/permisos
- `Wallet` para finanzas
- `Sparkle` para insights/IA
- `SlidersHorizontal` para ajustes
- `MagnifyingGlass` para búsqueda
- `Bell` para notificaciones
- `Question` para ayuda
- `Moon` / `Sun` para toggle de tema

---

## 9. Dark mode

### Filosofía

Dark mode **no es light invertido**. Está tuneado:

- **Sin negro puro.** Background `#0B0F1A` — slate tintado para reducir fatiga ocular.
- **Sin blanco puro en texto.** Body `#F5F7FB` — evita el efecto "vibración" en pantallas OLED.
- **Brand brillado.** Primary `#818CF8` (indigo-400) en lugar de `#4F46E5` — los oscuros no leen bien sobre canvas oscuro.
- **Borders sutiles pero visibles.** `#2A3142` da estructura sin gritar.
- **Soft backgrounds = rgba semitransparente** con el color brand al 14%. Mantiene el tinte sin opacar.

### Persistencia

```js
const STORAGE_KEY = "v4-theme";

function readTheme() {
  try {
    const q = new URLSearchParams(location.search).get("theme");
    if (q === "dark" || q === "light") return q;
  } catch (_) {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch (_) {}
  if (matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
}

applyTheme(readTheme());  // antes del primer render — evita flash
```

CSS:

```css
:root              { /* tokens light */ }
[data-theme="dark"] { /* tokens dark */ }
```

### Toggle

Botón compacto al pie del sidebar. Ícono luna o sol según estado actual:

```jsx
<button onClick={toggleTheme}>
  {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
</button>
```

---

## 10. Motion

**Sutil, no llamativa.** El movimiento sirve a la comprensión, no decora.

```css
--t-fast: 120ms;
--t-base: 200ms;
--easing: cubic-bezier(0.2, 0, 0, 1);   /* fast-out, slow-in */
```

Reglas:

- **Hover de botones**: `transition: background var(--t-base) var(--easing);`
- **Lift de cards clickables**: `transform: translateY(-1px)` máximo, no más
- **Modales/drawers**: fade del scrim 200ms + slide del panel 250ms
- **Skeleton loaders**: pulso suave de `--surface-muted` ↔ `--surface-strong`, 1.5s
- **Sin spinners de página completa.** Si tarda, skeletons o progreso parcial

Respetar `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

---

## 11. Accesibilidad

- **Contraste body ≥ 7:1** (AAA) en ambos modos
- **Contraste muted ≥ 4.5:1** (AA)
- **Focus visible siempre.** No quitar outline sin reemplazo. Usar `--shadow-focus`
- **Touch targets 40×40 mínimo** (44×44 en mobile)
- **Aria labels en íconos sin texto** (sidebar items, theme toggle, close buttons)
- **Color nunca solo.** Estados (success/danger) siempre con ícono o texto adicional

---

## 12. Reglas duras (no negociables)

1. **Sin webfonts**. System stack obligatorio.
2. **Sin `background-clip: text`** para títulos. Color sólido siempre.
3. **Sin `!important`** en estilos de producto. Resuelve por especificidad/orden.
4. **Sin emojis en UI**. (Banderas en selectores de país son la excepción.)
5. **Sin negro puro `#000`** ni blanco puro `#fff` en backgrounds.
6. **Sin border radius 0** salvo separadores horizontales internos.
7. **Sin gradientes en botones**. Gradiente reservado a sidebar y brand mark.
8. **Sin shadows duras grises** (tipo `0 2px 4px gray`). Tintadas frías o nada.
9. **Sin más de un acento por vista.** Si dos cosas son "violeta", una está mal.
10. **Sin Tailwind**. CSS plano + variables. La dirección del proyecto es legible y refactorizable.

---

## 13. Referencia visual

Los HTML estáticos del lenguaje viven en `mocks-UX/v4/`:

```
mocks-UX/v4/01-control-hoy.html         ← dashboard
mocks-UX/v4/02-coordinacion-semana.html ← timeline
mocks-UX/v4/05-clientes.html            ← lista
mocks-UX/v4/08-busqueda.html            ← búsqueda global
mocks-UX/v4/09-notificaciones.html      ← centro de avisos
mocks-UX/v4/11-equipo.html              ← directorio
mocks-UX/v4/13-ajustes.html             ← settings con tabs

mocks-UX/v4/assets/tokens.css   ← sistema de tokens completo
mocks-UX/v4/assets/base.css     ← componentes base
mocks-UX/v4/assets/shell.js     ← shell injector + theme
```

Abrirlos en navegador, alternar tema con el botón luna/sol del sidebar, **es la fuente de verdad del lenguaje**. Cualquier app que tome este lenguaje como base debe sentirse familiar al lado de estos mockups: misma textura, misma respiración, mismo dark mode.

---

## 14. Stack mínimo recomendado

Para una app nueva que adopte este lenguaje:

- **CSS**: variables + archivos planos (no Tailwind, no CSS-in-JS pesado)
- **Iconos**: Phosphor (`@phosphor-icons/react` para React, `@phosphor-icons/web` para vanilla)
- **Fonts**: ninguna externa — system stack
- **Layout**: CSS Grid para shell, Flexbox para componentes
- **Theme**: `data-theme` attribute en `<html>` + localStorage + `prefers-color-scheme` fallback
- **Motion**: CSS transitions, no librerías

El lenguaje no depende de un framework. Funciona igual en React, Vue, Svelte, vanilla, o HTML estático.
