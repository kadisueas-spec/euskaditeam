# FitCoach — Plataforma de Entrenamiento Personalizado

## Descripción del proyecto
Aplicación web para coaching de entrenamiento personalizado online. El coach crea rutinas personalizadas para cada cliente, quienes acceden mediante suscripción mensual. Los clientes registran sus entrenamientos y el coach puede dejarles feedback, correcciones y tips.

## Stack tecnológico
- **Frontend:** Next.js 14 (App Router) + TypeScript
- **Estilos:** Tailwind CSS + shadcn/ui
- **Base de datos:** Supabase (PostgreSQL + Auth + Storage)
- **Pagos:** Stripe (suscripciones recurrentes)
- **Videos:** YouTube (no listados) — se migra a Cloudflare Stream cuando escale el negocio
- **Hosting:** Vercel
- **PWA:** Serwist (instalable en iPhone/Android sin App Store) — migrado desde
  next-pwa en jul-2026, ver "Deuda técnica y pendientes"

## Roles de usuario
- **coach** → acceso total: crea rutinas, gestiona clientes, sube videos, deja feedback
- **client** → acceso limitado: ve su rutina, registra entrenamientos, ve su progreso

## Estructura de carpetas objetivo
```
fitcoach/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (coach)/
│   │   ├── dashboard/
│   │   ├── clients/
│   │   ├── routines/
│   │   ├── exercises/
│   │   └── feedback/
│   ├── (client)/
│   │   ├── my-routine/
│   │   ├── log-workout/
│   │   ├── progress/
│   │   └── profile/
│   └── api/
│       ├── stripe/
│       └── webhooks/
├── components/
│   ├── ui/           ← shadcn components
│   ├── coach/
│   └── client/
├── lib/
│   ├── supabase/
│   ├── stripe/
│   └── utils/
├── public/
│   ├── manifest.json       ← config PWA
│   ├── sw.js               ← service worker (generado por next-pwa)
│   └── icons/              ← íconos en múltiples tamaños
│       ├── icon-192x192.png
│       ├── icon-512x512.png
│       └── apple-touch-icon.png
└── types/
```

## Módulos a construir (en orden)

### Fase 1 — Fundamentos + PWA
1. Configurar Next.js 14 + TypeScript + Tailwind + shadcn/ui
2. Integrar Supabase Auth con roles (coach / client)
3. Crear schema completo de base de datos (ver schema.sql)
4. Middleware de protección de rutas por rol
5. Configurar PWA con next-pwa:
   - manifest.json con nombre, colores, íconos
   - Service worker para caché offline
   - apple-touch-icon para iPhone
   - Meta tags específicos de iOS en layout.tsx
   - Banner "Instalá la app" para guiar al usuario

### Fase 2 — Panel del Coach
5. Dashboard del coach (resumen de clientes activos)
6. Gestión de clientes (lista, perfil, estado de suscripción)
7. Biblioteca de ejercicios (crear, editar, subir video demostrativo)
8. Creador de rutinas (asignar días, ejercicios, sets, reps, RIR, notas)
9. Asignación de rutina a cliente específico

### Fase 3 — App del Cliente
10. Vista de rutina semanal del cliente
11. Pantalla de registro por sesión (peso / reps / RIR por serie)
12. Historial de entrenamientos
13. Estadísticas y gráficos de progreso (peso levantado, volumen, adherencia)

### Fase 4 — Feedback y Comunicación
14. Sistema de feedback del coach (por sesión, por ejercicio)
15. Notificaciones al cliente cuando hay feedback nuevo
16. Sección de notas/tips del coach dentro de cada rutina
17. Correcciones técnicas por ejercicio

### Fase 4.5 — Objetivos Mensuales y Ventana de Progreso
Objetivo: maximizar la adherencia al plan mediante un sistema de objetivos
mensuales con una ventana de progreso bloqueada que se desbloquea al
cumplirse el mes. El cliente sabe que existe y eso lo motiva a entrenar
todo el mes.
18. Modal obligatorio de objetivo mensual — aparece una sola vez en el
    primer login del mes, no se puede cerrar sin completarlo (objetivo
    principal, peso actual, energía/motivación 1-5, qué quiere mejorar).
    El coach puede ver los objetivos de cada cliente desde su panel.
19. Pestaña "Mi Mes" con ventana de progreso bloqueada durante el mes:
    días entrenados vs. planificados, barra de progreso, objetivo
    propuesto, racha actual, y una tarjeta con candado que anticipa el
    desbloqueo de fin de mes.
20. Ventana de progreso desbloqueada automáticamente el último día del
    mes: objetivo vs. métricas reales, adherencia final, evolución de
    cargas en ejercicios principales, volumen total del mes, comparación
    con el mes anterior, y sección "Mensaje de tu coach".
21. Cierre de mes del coach en `/coach/clients/[id]`: resumen del mes,
    objetivos para el mes siguiente, ajustes al plan. Alerta en el
    dashboard del coach cuando el mes de un cliente termina y falta
    completar su cierre.

### Fase 5 — Pagos y Suscripciones (PayPal, no Stripe)
Stripe (`lib/stripe/client.ts`/`server.ts`) quedó vestigial — nunca se
conectó (sin rutas `/api`, sin checkout, sin webhook, env vars vacías).
El procesador real de pagos es **PayPal Subscriptions** (jul-2026):
22. `lib/paypal/` — cliente OAuth2 (`client.ts`), producto único de la
    app creado una sola vez (`products.ts`, `PAYPAL_PRODUCT_ID` en env —
    "Opción A": un Product, un Plan dinámico por cliente/precio, una
    Subscription por cliente), creación de plan+suscripción
    (`plans.ts`/`subscriptions.ts`), manejo de eventos del webhook
    (`webhooks.ts`).
23. `/coach/clients/[id]` → sección Acceso: campo "Precio mensual (USD)"
    + botón "Generar link de pago PayPal" (`app/coach/clients/[id]/
    paypal-actions.ts`, `generatePaymentLink`) — si `PAYPAL_PRODUCT_ID`
    todavía no existe, lo crea y corta el flujo pidiendo agregarlo a las
    env vars (para no arriesgarse a crear un Product duplicado en cada
    invocación mientras el env var no se propagó). Estado de la
    suscripción (Activa/Cancelada/Pago fallido/Pendiente) y botón
    "Cancelar suscripción".
24. `deactivateClientAccess` (acceso manual del coach) ahora es
    PayPal-aware: si `payment_method = "paypal"`, además de cortar el
    acceso cancela la suscripción real en PayPal — pero el acceso se
    corta en la app SIEMPRE, incluso si la llamada a PayPal falla (nunca
    al revés). El cliente tiene su propio botón "Cancelar suscripción" en
    `/client/profile` con la asimetría inversa a propósito: si PayPal
    falla, NO se corta el acceso local (para no dejarlo pagando sin
    poder entrar) — se le pide que contacte al coach.
25. `POST /api/paypal/webhook`: `BILLING.SUBSCRIPTION.ACTIVATED` →
    `active`, `CANCELLED` → `canceled`, `SUSPENDED`/`PAYMENT.FAILED` →
    `past_due`, `PAYMENT.SALE.COMPLETED` → confirma `active`. Gateado por
    `PAYPAL_VERIFY_WEBHOOK` (`false` en sandbox mientras no existe
    `PAYPAL_WEBHOOK_ID` — hay que deployar primero, registrar la URL en
    el Dashboard de PayPal, recién ahí se puede prender la verificación
    de firma; `true` siempre en producción). `custom_id` en la
    suscripción de PayPal lleva el `client_id` para que el webhook pueda
    mapear el evento sin depender de haber guardado nada más de
    antemano; para eventos sin `custom_id` (ej. `PAYMENT.SALE.COMPLETED`)
    hace fallback buscando por `subscriptions.paypal_subscription_id`.
26. `subscriptions.stripe_subscription_id` pasó a nullable (la tabla
    estaba vacía, Stripe nunca la usó) + columnas `paypal_subscription_id`
    (constraint único **normal**, no parcial — un índice parcial rompe el
    `ON CONFLICT` que usa el upsert del webhook, error 42P10 confirmado
    corriendo el webhook real) / `paypal_plan_id` / `paypal_payer_email`
    + policies RLS (la tabla tenía RLS activado pero cero policies, quedaba
    bloqueada para todo lo que no fuera el service role).
27. `return_url`/`cancel_url` de PayPal apuntan a
    `/client/subscription-confirmed` — esa pantalla NUNCA activa el acceso
    por sí misma (solo lee el estado que ya dejó el webhook, con polling
    corto mientras llega); si activara algo a partir de los parámetros de
    la URL, cualquiera podría fabricarla a mano y activarse sin pagar.

### Fase 6 — Videos ✅ Completa
26. Video demostrativo por ejercicio via YouTube (no listado) — solución
    gratuita elegida en lugar de Cloudflare Stream; se integra Cloudflare
    Stream más adelante cuando escale el negocio. El coach pega la URL de
    YouTube en `/coach/exercises/new` o `/coach/exercises/[id]/edit` y el
    sistema extrae el ID automáticamente (`lib/constants/youtube.ts`).
27. Reproductor de YouTube embebido en la vista del ejercicio del cliente;
    si el ejercicio no tiene video se muestra el placeholder "Video
    demostrativo próximamente" (`components/client/exercise-video.tsx`).
28. Miniatura e ícono de video en la biblioteca de ejercicios del coach,
    generados automáticamente a partir del ID de YouTube (no hace falta
    subir ni comprimir nada).

### Fase 7 — PWA Avanzada ✅ Completa
29. Caché offline de la rutina activa del cliente (puede ver sus ejercicios sin
    internet) — Service Worker con cache dedicado para `/client/my-routine` y
    `/client/log-workout`, banner "Estás offline — mostrando datos guardados".
    Requirió registrar el service worker a mano (`components/service-worker-register.tsx`)
    porque next-pwa v5 solo lo auto-inyecta en Pages Router, no en App Router.
30. Caché offline de los videos más recientes — no aplica de la misma forma:
    los videos son de YouTube embebido (ver Fase 6), no hay archivos propios
    que cachear; el embed simplemente no carga sin conexión.
31. Sincronización en background cuando vuelve la conexión (registró series
    offline) — IndexedDB (`lib/offline/workout-store.ts`) guarda entrenamientos
    sin conexión y los sincroniza solo al reconectar
    (`lib/offline/sync-workouts.ts`), con banners "Sincronizando tu
    entrenamiento..." y "Todo sincronizado ✓".
32. Push notifications via Web Push API — permiso pedido una sola vez al
    cliente, suscripción guardada en `push_subscriptions` (RLS), push
    inmediato al dejar feedback el coach. Recordatorios programados
    (lunes/miércoles/viernes 9am) y chequeos diarios (desbloqueo de fin de
    mes, inactividad de 3 días) corren como Supabase Edge Functions
    (`supabase/functions/weekly-reminders`, `supabase/functions/daily-checks`)
    con `pg_cron` — desplegadas manualmente vía el Dashboard de Supabase
    (Edge Functions no se pueden deployar sin las credenciales del proyecto).
    Mejora de paso: `InstallBanner` ahora detecta específicamente Safari en
    iOS (no solo "es iPhone"), ya que Chrome/Firefox en iOS no muestran el
    mismo flujo de instalación.
32.1. Push notifications ampliadas — ahora también al **coach**, no solo al
    cliente: `push_subscriptions` pasa a soportar `coach_id` además de
    `client_id` (nullable + CHECK de que se use exactamente uno de los
    dos — ver migración `supabase/migrations/20260708_coach_push_subscriptions.sql`,
    hay que correrla a mano en el SQL Editor del Dashboard, igual que las
    Edge Functions). El coach recibe el mismo prompt de activación que el
    cliente (`components/coach/push-permission-prompt.tsx`), la primera vez
    que abre el dashboard.
    - Al cliente: push "Tenés nueva rutina disponible 💪" cuando el coach
      crea o edita su rutina (`createRoutine`/`updateRoutine`).
    - Al coach: push "[cliente] ya completó el 80% de su rutina este mes 🔥"
      la primera vez que la adherencia del mes cruza el 80% (se compara
      antes/después de cada sesión completada en `finishWorkout`, así no
      se repite en cada sesión posterior una vez que ya se cruzó).
    - Al coach: recordatorio de mesociclo por terminar, 7 y 2 días antes
      (chequeo diario en `daily-checks` sobre `routines.ends_at`, que ahora
      sí se completa — `duration_weeks`/`starts_at`/`ends_at` ya existían en
      el schema pero no se usaban desde ningún lado; se agregaron los
      campos "Duración (semanas)" y "Fecha de inicio" al creador/editor de
      rutina, default 4 semanas = un mesociclo).
    - Alerta en el dashboard del coach — "[cliente] no tiene rutina
      activa" — cuando un cliente activo no tiene ninguna rutina vigente
      (`getNoActiveRoutineAlerts` en `lib/supabase/routines.ts`).

### Fase 9 — Métricas Avanzadas de Entrenamiento
Objetivo: darle al coach una vista de evaluación de progreso real (pensada
para el cierre de mes) basada en los datos que el cliente ya carga al
registrar entrenamientos (`workout_set_logs`: peso, reps y RIR por serie) y
el grupo muscular de cada ejercicio (`exercises.muscle_group`). No hace
falta ninguna tabla nueva — todo se calcula agregando estos datos.
33. Capa de cálculo (`lib/supabase/metrics.ts`): tonelaje (series × reps ×
    carga) por grupo muscular, por ejercicio y total; series efectivas por
    grupo muscular por semana (toda serie cargada cuenta como efectiva —
    el schema no distingue series de calentamiento); volumen por sesión;
    distribución de intensidad por RIR (% de series en RIR ≥3, 2, 1 y 0,
    contado por cantidad de series, no por tonelaje); evolución de carga
    por ejercicio. Las sesiones no finalizadas también cuentan (las series
    ya están guardadas en el servidor apenas se completan, ver Fase 3/A).
    Filtro de rango con tres granularidades: Semana, Mes y Bloque (el
    bloque es un mesociclo estandarizado de 4 semanas, no una tabla de la
    base — se calcula agrupando semanas de a 4).
34. Tab "Métricas" en `/coach/clients/[id]` (junto a "Resumen"): tonelaje
    por grupo muscular en el tiempo, tonelaje y carga por ejercicio
    (selector de ejercicio), distribución RIR por semana/mes/bloque —
    pensada para evaluar el progreso del cliente a fin de mes.
35. Versión resumida en `/client/progress/stats` para el cliente: tonelaje
    total del período, tonelaje por grupo muscular y distribución RIR
    simplificada (sin desglose ejercicio por ejercicio, eso queda solo
    para la vista del coach).

## Convenciones de código
- Siempre usar TypeScript estricto (no `any`)
- Server Components por defecto, Client Components solo cuando necesario (`'use client'`)
- Toda lógica de base de datos en `lib/supabase/` (nunca en componentes)
- Nombres de archivos: kebab-case para rutas, PascalCase para componentes
- Comentarios en español

## Variables de entorno necesarias
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=
PAYPAL_PRODUCT_ID=
PAYPAL_WEBHOOK_ID=
PAYPAL_VERIFY_WEBHOOK=
```
(Las mismas VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT también deben
cargarse como secrets de las Supabase Edge Functions, no solo en `.env.local`.)
(Stripe queda documentado por si algún día se retoma, pero no está en uso —
ver Fase 5.)

## Reglas importantes
- NUNCA exponer SUPABASE_SERVICE_ROLE_KEY ni STRIPE_SECRET_KEY en el cliente
- Siempre validar el rol del usuario en el servidor antes de devolver datos
- Las rutas de coach deben estar protegidas con middleware
- Los clientes solo pueden ver SUS PROPIOS datos (RLS en Supabase)
- Siempre manejar estados de carga y error en el UI

## Reglas PWA
- El UI del cliente debe estar optimizado para mobile first (pantallas de 390px)
- Todos los touch targets deben ser mínimo 44x44px (estándar Apple)
- Usar `viewport-fit=cover` para respetar el notch del iPhone
- La rutina activa del cliente SIEMPRE debe estar disponible offline
- El registro de series debe funcionar offline y sincronizar al reconectarse
- Evitar hover states — en mobile no existen; usar active/focus states
- El coach puede usar la app desde desktop; el cliente principalmente desde mobile

## Deuda técnica y pendientes
- ✅ Resuelto (jul-2026): migración de next-pwa a Serwist (`@serwist/next` +
  `serwist`). `next.config.ts` usa `withSerwistInit` en vez de `withPWA`;
  `worker/index.js` pasó de ser un "extra" inyectado a ser el service worker
  fuente completo (swSrc) — precache vía `self.__SW_MANIFEST`, `defaultCache`
  de `@serwist/next/worker` en vez de `next-pwa/cache`, mismas 2 reglas
  runtime custom (`fitcoach-active-routine` NetworkFirst + catch-all
  NetworkOnly del fix F6) traducidas a la sintaxis de clases de Serwist
  (`NetworkFirst`/`NetworkOnly`/`ExpirationPlugin`/`CacheableResponsePlugin`
  en vez de strings + `options`), mismos 3 listeners (`push`,
  `notificationclick`, `message` de logout). `register: false` porque el
  registro sigue siendo manual en `components/service-worker-register.tsx`
  (sin cambios, sigue apuntando a `/sw.js`). `npm audit` pasó de 7
  vulnerabilidades (cadena de next-pwa: serialize-javascript,
  rollup-plugin-terser, workbox-build, workbox-webpack-plugin) a 2
  moderadas, ambas de un `postcss` interno de `next` mismo, sin relación con
  esta migración. Nota menor no accionable: los usuarios que ya tenían el
  service worker viejo de next-pwa van a quedar con algunos caches
  huérfanos con nombres estilo Workbox (`workbox-precache-v2-...`,
  `google-fonts-webfonts`, etc.) que el nuevo SW de Serwist no borra
  automáticamente por tener otro prefijo de nombre — no rompe nada (el
  routing lo maneja 100% el SW nuevo), solo ocupa algo de storage hasta que
  el navegador lo libera solo.
- Configurar SMTP propio (Resend) para superar el límite de 2 emails/hora
  del plan gratuito de Supabase Auth (magic links, confirmaciones, etc.).

## Identidad de marca (referencia rápida)

**Euskadi Team** — app de entrenamiento personalizado de Luis Mineur. Tono:
directo y exigente, pero cercano y motivador (un coach que empuja fuerte
porque cree en vos).

- **Colores:** negro `#080808` (fondo) + rojo `#E8001C` (acento, uso
  reservado — CTA y momentos de intensidad) + blanco `#F5F5F5` (texto).
- **Tipografía:** Bebas Neue para títulos y números protagonistas
  (peso/reps/RIR), DM Sans para todo lo demás.
- **Estilo:** plano, sin sombras grises — jerarquía por borde/ring y glow
  rojo. Nada de gradientes violeta-azul ni look genérico de SaaS o de app
  de fitness masiva.

**Fuente de verdad para diseño:** [`PRODUCT.md`](PRODUCT.md) (identidad,
usuarios, principios estratégicos) y [`DESIGN.md`](DESIGN.md) (colores,
tipografía, componentes, tokens). Ante cualquier diferencia con este
resumen, esos archivos mandan — este bloque es solo un puntero rápido,
no se actualiza en paralelo.
