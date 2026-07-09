---
name: Euskadi Team
description: App de entrenamiento personalizado — negro y rojo, directa, para atletas serios que entrenan bajo presión de tiempo.
colors:
  primary: "#E8001C"
  primary-glow-end: "#FF4D4D"
  background: "#080808"
  surface-card: "#111111"
  surface-elevated: "#1A1A1A"
  border: "#1E1E1E"
  border-subtle: "#2A2A2A"
  text-primary: "#F5F5F5"
  text-secondary: "#C9C9C9"
  text-muted: "#888888"
  text-faint: "#666666"
  text-disabled: "#555555"
  text-disabled-deep: "#333333"
typography:
  display:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.02em"
  hero-wordmark:
    fontFamily: "Anton, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.02em"
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  4xl: "26px"
  pill: "9999px"
  hero-card: "32px"
spacing:
  touch-target: "44px"
  card-padding: "16px"
  card-padding-sm: "12px"
  page-margin: "24px"
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, {colors.primary}, {colors.primary-glow-end})"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
    height: "32px"
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  input-standard:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  input-auth:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.2xl}"
    padding: "0 16px 0 48px"
    height: "56px"
---

# Design System: Euskadi Team

## 1. Overview

**Creative North Star: "El coach en la esquina del ring"**

Euskadi Team se siente como ese entrenador que te empuja fuerte porque cree en vos: exigente, sin vueltas, pero siempre a tu favor. Nada decorativo de más — como un coach que no pierde tiempo en chachará, cada elemento de la interfaz tiene un propósito. Los momentos de intensidad (un récord, el cierre de mes, terminar el entrenamiento) se sienten como esa arenga en la esquina: potentes y motivadores, no un chime genérico de "logro desbloqueado".

La legibilidad manda sobre cualquier sutileza: el cliente típico usa la app parado en el gimnasio, con la pantalla al sol y apuro entre series, así que la información tiene que entrar de un vistazo. La firmeza visual (negro, rojo, tipografía condensada y grande) transmite autoridad, equilibrada por una voz cercana en los textos — exigente en el tono, cómodo en el uso.

Este sistema rechaza explícitamente el look genérico de SaaS (gradientes violeta-azul, el "hero-metric template", grids de cards idénticas), cualquier estética de app de fitness de descarga masiva (colores pasteles, íconos redondeados genéricos, tono "amigable" edulcorado), y los tells de IA ya identificados: eyebrows en mayúsculas arriba de cada sección, bordes laterales de color como acento, texto con gradiente, glassmorphism decorativo.

**Key Characteristics:**
- Negro absoluto como base, no gris oscuro genérico — el rojo es la única fuente de calidez.
- Los números (peso, reps, RIR, series) son protagonistas: grandes, en Bebas Neue, nunca escondidos en texto chico.
- Profundidad por borde/ring y luz, no por sombra gris.
- El glow rojo es un recurso reservado para el CTA principal y los momentos de intensidad — no omnipresente.
- Touch targets grandes y feedback táctil instantáneo (`:active` con scale), pensados para uso con apuro, a veces con guantes o manos sudadas.

## 2. Colors

Paleta de dos temperaturas: negro absoluto como base silenciosa, rojo vibrante como la única voz que interrumpe — nunca decorativa, siempre con intención.

### Primary
- **Rojo Euskadi** (#E8001C): el acento de marca. CTA principal, focus rings, indicadores de récord/progreso, `--ring` de foco de teclado. Marca lo que importa; no se usa de relleno.
- **Glow Rojo Claro** (#FF4D4D): extremo cálido del gradiente `gradient-accent` (135deg) usado en el botón primario — da sensación de energía sin diluir el rojo base.

### Neutral
- **Negro Vestuario** (#080808): fondo base de toda la app (`--background`). La app es siempre dark; no existe un tema claro.
- **Carbón** (#111111): superficie de cards, popovers, sidebar y campos de formulario estándar (`--card`, `--secondary`, `--muted`).
- **Grafito** (#1A1A1A): superficie de los inputs premium de autenticación (`AuthInput`) — un tono más claro que Carbón para separarse visualmente del fondo del `AuthCard`.
- **Borde Ceniza** (#1E1E1E): borde/divisor estándar en toda la app (`--border`, `--input`, `--accent`).
- **Borde Ceniza Claro** (#2A2A2A): borde de los inputs premium de autenticación, ligeramente más visible que el borde estándar.
- **Blanco Hueso** (#F5F5F5): texto principal sobre fondo oscuro (`--foreground`).
- **Gris Neblina** (#C9C9C9): texto secundario sobre el hero de autenticación (subtítulos sobre el degradado).
- **Gris Cronómetro** (#888888): texto muted — labels secundarios, timestamps, texto de apoyo (`--muted-foreground`).
- **Gris Ícono** (#666666): íconos y placeholder text dentro de los inputs premium de autenticación.

### Named Rules
**The Red Restraint Rule.** El rojo con glow es un recurso reservado, no un color de fondo. Se usa en el CTA principal de cada pantalla y en momentos de intensidad (récords, cierre de mes, entrenamiento completado) — nunca en todos los botones ni en elementos secundarios. Coherente con el North Star: firme y potente cuando importa, no gritando todo el tiempo.

**The No-Gray-Shadow Rule.** En dark mode las sombras grises tradicionales se ven sucias. La separación entre superficies se resuelve con bordes/ring sutiles y con la propia luz del rojo, nunca con `box-shadow` gris difuso.

## 3. Typography

**Display Font:** Bebas Neue (con fallback sans-serif)
**Body Font:** DM Sans (variable, con fallback sans-serif)

**Character:** Bebas Neue condensada y en mayúsculas para todo lo que deba leerse como un marcador — títulos, cifras de peso/reps/RIR, el nombre de la marca. DM Sans para todo lo demás: texto de apoyo, formularios, navegación — sobria y muy legible en pantallas chicas al sol.

### Hierarchy
- **Display** (400, 2.25rem / 36px, line-height 1, tracking amplio, uppercase): números y títulos protagonistas en toda la app (peso levantado, reps, RIR, contadores de racha, encabezados de sección). Es el elemento que más peso visual tiene en cualquier pantalla donde aparece.
- **Hero Wordmark** (Anton, 400, 2.25rem / 36px, line-height 1, tracking amplio, uppercase): **excepción puntual**, solo el wordmark "Euskadi Team" en el hero de login/registro/recuperar contraseña (`AuthHero`). Anton tiene un trazo más grueso y macizo que Bebas Neue — más cercano al material gráfico de Instagram de la marca (flyers, carruseles) — y se usa ahí porque el wordmark es secundario al tridente (que es el objeto central del hero) y necesita presencia sin competir con Bebas Neue en el resto de la app. No reemplaza a Display en ningún otro lugar.
- **Title** (700, 1rem / 16px, line-height 1.3): encabezados de card, nombres de ejercicio/rutina.
- **Body** (400, 0.875rem / 14px, line-height 1.5): texto de contenido general, descripciones, listas de series.
- **Label** (500, 0.75rem / 12px, line-height 1.2): labels de navegación, badges, texto de formularios chico.

### Named Rules
**The Numbers-Are-Protagonists Rule.** Peso, reps, RIR y series son el contenido real de esta app. Van siempre en Bebas Neue, grandes — nunca en texto chico gris ni escondidos dentro de una oración.

**The One-Exception Rule.** Anton existe en el sistema únicamente para el wordmark del hero de auth. Cualquier otro título grande usa Bebas Neue (Display); no se agregan más fuentes de impacto sin pasar de nuevo por esta discusión.

## 4. Elevation

El sistema es plano por defecto: no hay una biblioteca de `box-shadow` grises que simule profundidad. La jerarquía se resuelve con tres niveles de luz — fondo base, superficie de card con borde sutil, y elementos activos/destacados marcados con borde o glow rojo — nunca con sombra difusa gris, que en fondo negro absoluto se lee "sucia".

### Shadow Vocabulary
- **glow-red** (`box-shadow: 0 0 20px rgba(232, 0, 28, 0.4)`): resplandor del botón primario en reposo.
- **glow-red hover** (`box-shadow: 0 0 28px rgba(232, 0, 28, 0.55)`): resplandor del botón primario en hover/focus, junto con `brightness(1.1)`.
- **glow-red-sm** (`box-shadow: 0 0 12px rgba(232, 0, 28, 0.3)`): versión reducida para elementos secundarios que igual necesitan destacar.
- **glow-pulse** (`box-shadow` animado entre `0 0 12px rgba(232,0,28,.35)` y `0 0 28px rgba(232,0,28,.65)`, 2.4s ease-in-out infinito): reservado para momentos de intensidad — récords, celebraciones, el candado de "Mi Mes".

### Named Rules
**The Three-Level Rule.** Fondo base (#080808) < superficie de card (#111111 con borde #1E1E1E) < elemento activo/destacado (borde o glow rojo). Nunca más de tres niveles de profundidad visible en una misma pantalla.

## 5. Components

### Buttons
- **Shape:** esquinas redondeadas suaves (`rounded-lg`, 10px).
- **Primary:** degradado `gradient-accent` (135deg, #E8001C → #FF4D4D) con glow-red permanente; `hover:` sube a glow-red intenso + `brightness(1.1)`. Texto en Blanco Hueso, tipografía Label.
- **Outline:** fondo transparente/`--background`, borde `--border`, hover a `--muted`. Sin glow — reservado para acciones secundarias.
- **Ghost / Secondary / Destructive:** variantes de baja intensidad, sin degradado ni glow, para acciones de menor jerarquía.
- **Hover / Focus:** feedback táctil instantáneo — `:active` aplica `scale(0.96)` + `opacity(0.85)` en 0.1s, sin esperar a soltar el toque (elimina la sensación de delay en mobile).

### Chips / Badges
- **Style:** fondo Rojo Euskadi sólido, texto Blanco Hueso, forma píldora (`rounded-4xl`, totalmente redondeada), 20px de alto.
- **Variantes:** `secondary` (Carbón), `destructive` (rojo atenuado 10-20% opacidad), `outline` (borde `--border`, texto foreground) — se usan para estado de suscripción, alertas del dashboard del coach, conteos sin leer.

### Cards / Containers
- **Corner Style:** `rounded-xl` (14px) en cards estándar.
- **Background:** Carbón (#111111).
- **Shadow Strategy:** ninguna — ver Elevation. Separación por `ring-1 ring-foreground/10`.
- **Border:** el ring se intensifica a Rojo Euskadi (#E8001C) en hover, marcando interactividad sin sombra.
- **Internal Padding:** 16px (12px en variante `sm`).

### Inputs / Fields
- **Style estándar** (formularios de coach/cliente): borde `--input` (#1E1E1E), fondo transparente, `rounded-lg` (10px), 32px de alto.
- **Focus:** anillo de foco Rojo Euskadi (`ring-3 ring-ring/50`) + borde Rojo Euskadi.
- **Error:** borde y ring en `--destructive` (mismo rojo, con opacidad reducida en el ring).

### Navigation
- **Bottom nav (mobile, cliente y coach):** barra fija inferior, fondo negro semitransparente (`rgba(8,8,8,0.85)`) con `backdrop-filter: blur(20px)`, borde superior Borde Ceniza. Ítem activo en Rojo Euskadi, inactivo en Gris Cronómetro. Mínimo 44px de alto por touch target, feedback `active:scale-90`. Badge rojo circular para conteos sin leer (feedback nuevo).

### Hero + Ascending Card (signature, auth)
Patrón adoptado para login/registro/recuperar contraseña: un hero superior con degradado **radial** (`#2A0508 → #1A0306 → #080808`, centrado en 50% 50%) — el rojo irradia desde el centro exacto donde está el tridente y se apaga parejo hacia los cuatro bordes, así el ícono se lee centrado en el panel sin importar el alto de la pantalla (antes era un degradado lineal 180deg y el tridente se veía descentrado porque la mitad superior quedaba mucho más negra que la inferior). El tridente (228px, +10% sobre el tamaño base) es el objeto central del hero — más grande que el wordmark a propósito — con un glow rojo propio (`drop-shadow(0 0 36px rgba(232,0,28,0.45))`) más un halo difuso detrás (`blur-100px`, 35% opacidad). El wordmark "Euskadi Team" va debajo, más chico, en Anton (ver Typography § Hero Wordmark) — un lockup tipo firma, no un título que compita con el tridente. Seguido de una tarjeta (`AuthCard`) que sube y se superpone al hero con esquinas superiores muy redondeadas (32px) y `margin-top` negativo, animada con `slide-up-in` (0.5s, `cubic-bezier(0.16,1,0.3,1)`, sin dependencias de motion libraries — CSS puro para que funcione en Safari iOS viejo). Dentro, los inputs usan la variante premium (`AuthInput`): 56px de alto, ícono a la izquierda, fondo Grafito, borde Borde Ceniza Claro, foco en Rojo Euskadi.

## 6. Do's and Don'ts

### Do:
- **Do** usar Bebas Neue en mayúsculas para todo número o título protagonista (peso, reps, RIR, cifras de racha).
- **Do** reservar el glow rojo (`glow-red`, `glow-pulse`) para el CTA principal de cada pantalla y momentos de intensidad — récords, cierre de mes, entrenamiento completado.
- **Do** mantener touch targets de mínimo 44×44px en toda la UI de cliente.
- **Do** respetar `prefers-reduced-motion` en toda animación (transiciones, glows, celebraciones, el candado de "Mi Mes") — con reduced motion activado, mostrar la versión sin esas animaciones, nunca una versión rota o a medio hacer.
- **Do** resolver jerarquía y profundidad con bordes/ring sutiles y luz roja, no con sombra.

### Don't:
- **Don't** usar gradientes violeta-azul ni el "hero-metric template" genérico de SaaS.
- **Don't** repetir grids de cards idénticas sin jerarquía — cada card debe ganarse su lugar.
- **Don't** usar colores pasteles, íconos redondeados genéricos ni un tono "amigable" edulcorado — esto es una app de atleta serio, no una app de fitness de descarga masiva.
- **Don't** usar eyebrows en mayúsculas arriba de cada sección, bordes laterales de color como acento, texto con gradiente, o glassmorphism decorativo — tells de IA ya identificados y explícitamente prohibidos.
- **Don't** usar `box-shadow` gris difuso para simular elevación — en este fondo negro absoluto se ve sucio; usar borde/ring o glow rojo en su lugar.
- **Don't** usar el rojo como color de fondo o relleno decorativo — es un acento reservado, no un color de superficie.
