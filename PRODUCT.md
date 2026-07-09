# Product

## Register

product

## Users

Clientes de Euskadi Team: atletas y personas que entrenan en serio bajo
la guía de Luis Mineur, coach. Usan la app mayoritariamente desde el
celular, muchas veces **dentro del gimnasio** — pantalla al sol, con
apuro entre series — así que necesitan registrar datos rápido y sin
fricción. El coach (Luis) también usa la app desde escritorio para
gestionar rutinas, clientes y feedback.

Trabajo a realizar (jobs to be done):
- **Cliente**: seguir su rutina asignada, registrar cada serie
  (peso/reps/RIR) en tiempo real durante el entrenamiento —incluso
  offline—, ver su progreso y objetivos del mes, leer el feedback del
  coach.
- **Coach**: crear y ajustar rutinas, hacer seguimiento de la
  adherencia y el progreso de cada cliente, dejar feedback y
  correcciones técnicas, gestionar pagos y accesos.

## Product Purpose

Euskadi Team es la plataforma de entrenamiento personalizado online de
Luis Mineur. Reemplaza el PDF/WhatsApp genérico de rutina por una app
real: el coach diseña el plan, el cliente lo sigue y registra su
entrenamiento serie por serie, y el coach hace seguimiento de la
adherencia y deja feedback. Éxito = el cliente entrena más consistente
porque la herramienta se siente hecha a medida para él, no una app de
fitness genérica bajada de una tienda.

## Brand Personality

Directo y exigente, pero motivador y cercano — un coach que empuja
fuerte porque cree en vos, no un software que te sermonea. Tres
palabras: **exigente, cercano, premium**. Tiene que sentirse como "la
app de un coach que sabe lo que hace", no un producto de fitness
genérico.

Referencias que sí funcionan como ancla (parcial, no literal):
- El material educativo ya producido para Euskadi ("Cómo entender tu
  plan de entrenamiento"): fondo oscuro negro/gris, rojo como acento,
  tipografía bold grande, cards con badges numerados, lenguaje directo
  y motivador. Es la referencia más cercana a la identidad ya
  asentada — nuevas pantallas deben sentirse de la misma familia.
- Apps de coaching de fuerza premium: oscuras, con números grandes
  destacados para pesos/reps, sensación de "app de atleta serio".
- Patrón estructural (no de color) de apps tipo Solstice para login:
  hero arriba con degradado + tarjeta que sube desde abajo con el
  formulario — ya adoptado en Euskadi con la paleta propia.

## Anti-references

- Look genérico de SaaS: gradientes violeta-azul, el "hero-metric
  template", grids de cards idénticas.
- Cualquier cosa que se sienta como una app de fitness de descarga
  masiva: colores pasteles, íconos redondeados genéricos, tono
  "amigable" edulcorado.
- Tells de IA ya identificados a evitar activamente: eyebrows en
  mayúsculas arriba de cada sección, bordes laterales de color como
  acento, texto con gradiente, glassmorphism decorativo.

## Design Principles

1. **Números como protagonistas.** Peso, reps, RIR, series son el
   contenido real de esta app; van grandes, en Bebas Neue, nunca
   escondidos en texto chico gris.
2. **Rápido y legible bajo presión.** El cliente típico está en el
   gimnasio, apurado, con la pantalla al sol: contraste y touch
   targets grandes ganan por sobre cualquier sutileza visual.
3. **Rojo con intención, no decoración.** El acento #E8001C marca lo
   que importa (CTA, alertas, números clave) — no se usa de relleno.
4. **La marca ya existe, no se reinventa.** Negro + rojo + Bebas Neue
   + DM Sans es la identidad Euskadi; cada pantalla nueva reafirma esa
   identidad en vez de improvisar una paleta o tipografía nueva.
5. **Exigente en el tono, cómodo en el uso.** La voz puede empujar
   fuerte ("dale, una más"), pero la interacción nunca debe generar
   fricción — sin formularios largos, flujos confusos, o pasos de más.

## Accessibility & Inclusion

- WCAG 2.1 AA como estándar (no AAA).
- Blanco sobre negro ya cumple contraste sin problema. El rojo
  `#E8001C` sobre negro en **texto chico** hay que verificarlo puntual
  contra AA (4.5:1) — usarlo grande/bold, o sobre fondos claros,
  cuando el tamaño chico no cumpla.
- Touch targets mínimo 44×44px (estándar Apple, ya establecido en el
  proyecto).
- `prefers-reduced-motion` respetado en toda animación (transiciones,
  glows, celebraciones, el candado de "Mi Mes"): con reduced motion
  activado se debe ver una versión sin esas animaciones, nunca una
  versión rota o a medio hacer.
- Perfil de uso real: mayoría en celular, muchas veces en el gimnasio
  con la pantalla al sol y apuro entre series — la legibilidad y la
  velocidad de interacción priman sobre cualquier detalle estético.
