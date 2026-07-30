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
13.1. Temporizador de descanso automático (jul-2026): al completar una
    serie arranca solo con el `rest_seconds` de ese ejercicio (si es 0 o
    null, no arranca) — barra fija sobre la navegación
    (`components/client/rest-timer-bar.tsx`), controles −15s/+15s/Saltear,
    se queda clavado en 0:00 (no oculto) hasta la próxima serie. Persiste
    en `localStorage` por `workoutLogId` (`lib/utils/rest-timer-storage.ts`)
    para sobrevivir a navegar afuera y volver, o cerrar la app — el
    `endsAt` guardado es una marca de tiempo real, no un contador que se
    reinicia. Sonido con Web Audio API (beep generado, sin archivo) — el
    `AudioContext` se crea recién en el primer toque dentro de la pantalla
    de Entrenar (Safari iOS lo exige, si se crea al montar el componente
    queda mudo para siempre). Vibración con `navigator.vibrate?.()` (no
    existe en Safari iOS, siempre con optional chaining). Preferencias
    (temporizador on/off, sonido, vibración — las 3 activadas por
    default) en `/client/profile` (`rest-timer-settings.tsx`), guardadas
    en `clients.rest_timer_*` (no localStorage, para persistir entre
    dispositivos — migración `20260729_rest_timer_prefs.sql`). El toggle
    de vibración se oculta solo si el dispositivo no la soporta. El coach
    reusa el mismo `WorkoutLogger` en `/coach/my-training` sin pantalla de
    preferencias propia — recibe defaults (todo activado).
13.2. Sesiones "en curso" que quedaban huérfanas (jul-2026), dos arreglos
    en `/client/progress/[id]`: (1) completar todas las series de una
    sesión desde el historial nunca la marcaba como finalizada — nada en
    `addSetToPastLog`/`updateSet` toca `is_completed`. Ahora
    `finishPastLog` (`app/client/log-workout/actions.ts`) agrega un botón
    "Finalizar entrenamiento" en `HistoryDetail`, con oferta destacada en
    cuanto no falta ninguna serie (rastreado en vivo por
    `completedCounts`, sin esperar a recargar la página); si la sesión ya
    había pasado por `finishWorkout` alguna vez (`energy_level` no nulo)
    no vuelve a pedir energía/notas. Dispara el mismo
    `checkWeeklyCompletion` que `finishWorkout` (récords + celebración
    semanal), sin el push de 80% de adherencia (no tiene sentido para una
    sesión vieja). (2) El cliente ahora puede eliminar sus propias
    sesiones (`deleteWorkoutLog`, `delete-workout-log-button.tsx`,
    confirmación inline) — el RLS ya lo permitía ("Client manages own
    workout logs" aplica a todos los comandos sin fecha límite, no hizo
    falta migración nueva); el límite de 7 días es el mismo candado de
    aplicación que ya usan `updateSet`/`deleteSet`/`addSetToPastLog`. Las
    series se borran solas (`ON DELETE CASCADE`); récords/rachas/adherencia
    no necesitan recálculo aparte porque se computan en vivo desde
    `workout_logs`/`workout_set_logs` en cada lectura — el único dato
    persistido que puede quedar inconsistente es `weekly_celebrations`
    (lock de "semana ya celebrada"), así que si la sesión borrada había
    disparado esa celebración y borrarla deja la semana incompleta,
    `cleanupWeeklyCelebrationIfIncomplete` saca el lock.

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

### Fase 10 — Renovaciones y Retención de Clientes
Objetivo: que ningún cliente pierda acceso por sorpresa ni quede "colgado"
sin que el coach se entere, y que la inactividad prolongada no deje basura
de clientes viejos en la base — todo corre solo, sobre `daily-checks`.
36. 5 chequeos nuevos en `supabase/functions/daily-checks`, todos sobre
    `clients.subscription_end_date` (comparado con `daysAgo`, ya existente
    en el archivo): día -1 antes del vencimiento → push al cliente y al
    coach; día 0 → `subscription_status` pasa a `inactive` automáticamente,
    sin aviso; día +2 → push solo al coach; día +4 → aviso de eliminación
    en 24hs; día +5 → si sigue `inactive` (se re-chequea justo antes, por
    si el coach ya reactivó el acceso mientras tanto), elimina TODO el
    rastro del cliente. Cron actualizado de 8am a 9am PYT
    (`"0 13 * * *"` UTC) — hay que actualizarlo a mano en el Dashboard de
    Supabase, igual que el resto de esta Edge Function.
37. La eliminación del día +5 (`deleteInactiveClient`) borra en este orden
    exacto: (1) snapshot en `deleted_clients_log` — única tabla que
    sobrevive, `id`/`nombre`/`email`/`subscription_end_date`/fecha, RLS
    scoped por `coach_id`; (2) archivos del bucket `nutrition-plans` en
    Storage (el DELETE de la fila de `nutrition_plans` no borra el archivo
    físico); (3) `monthly_goals`/`monthly_reviews` a mano — son las únicas
    dos tablas con FK a `clients` sin `ON DELETE CASCADE`; (4)
    `supabase.auth.admin.deleteUser()` — borra el login para siempre (no
    puede volver a entrar con ese email sin invitación nueva) y cascadea
    automático todo lo demás (`profiles` → `clients` → feedback, rutinas,
    workout_logs/set_logs, evaluaciones antropométricas, nutrition_plans,
    weight_logs, subscriptions, push_subscriptions). La card "Suscripciones
    por vencer en 7 días" del dashboard del coach (`expiringSoon` en
    `lib/supabase/dashboard.ts`) ya cubría el aviso preventivo — no hizo
    falta tocar el dashboard para este módulo.
    Migración: `supabase/migrations/20260722_deleted_clients_log.sql`.
38. Excepción para cuentas de prueba dedicadas (ej. el cliente E2E de
    Playwright, `e2e-test-client@fitcoach.test`): el query de vencimiento
    de `daily-checks` filtra `.not("subscription_end_date", "is", null)`,
    así que un cliente con `subscription_status = 'active'` y
    `subscription_end_date = NULL` queda **totalmente afuera** del loop de
    aviso/eliminación — acceso activo permanente sin fecha de vencimiento
    que mantener, sin tocar código del Edge Function (que se deploya a
    mano). Se eligió sobre una excepción por dominio en el código porque
    no requiere redeploy y reusa la lógica que ya existe (`isAccessActive`
    también trata `subscription_end_date: null` como "sin vencimiento").
    Aplicar el mismo patrón a cualquier otra cuenta de prueba futura.

### Fase 10.5 — Fotos de Progreso Corporal
Objetivo: complementar las evaluaciones antropométricas con evidencia
visual — el dato medido (peso, % grasa) acompañado de la foto de ese
momento, no una galería genérica.
39. `progress_photos` (migración `supabase/migrations/20260730_progress_photos.sql`):
    `client_id`, `taken_at` (fecha automática al subir, no la elige el
    cliente), `category` (`front`/`side`/`back`, opcional), `storage_path`.
    RLS espejo invertido del patrón de `nutrition_plans` — ahí el coach
    gestiona y el cliente solo lee; acá el **cliente** gestiona (sube y
    borra las suyas) y el **coach** solo lee las de sus clientes. Bucket
    de Storage `progress-photos`, privado, creado a mano en el Dashboard
    (Storage > New bucket) antes de correr la migración. Política de
    `storage.objects` verifica `(storage.foldername(name))[1]::uuid` (el
    primer segmento del path = `client_id`) contra el cliente autenticado
    — mismo mecanismo que ya usa `nutrition-plans`, evita que un cliente
    acceda a fotos de otro manipulando la URL.
40. Compresión en el cliente antes de subir (`lib/utils/compress-image.ts`):
    `createImageBitmap` + `<canvas>`, reescala al lado mayor a 1200px y
    reencodea siempre a JPEG calidad 0.8 sea cual sea el formato original
    — así el servidor solo valida UNA firma de archivo. Validación de
    magic bytes en `app/client/progress/photos-actions.ts`
    (`hasValidImageSignature`, firma JPEG `FF D8 FF` o PNG por si el
    compresor falla y llega el archivo sin comprimir) — mismo criterio
    que los PDFs de nutrición en la auditoría de seguridad, nunca confiar
    en `file.type` del navegador. URLs firmadas de 300s
    (`lib/supabase/progress-photos.ts`), regeneradas en cada lectura del
    servidor, mismo patrón que `lib/supabase/nutrition.ts`.
41. UI cliente (`components/client/progress-photos-section.tsx`), dentro
    de la pestaña "Mi Cuerpo" (`body-tab.tsx`) junto a las evaluaciones:
    grilla de miniaturas por fecha (más reciente primero), botón "Agregar
    foto" con selector opcional de categoría, input de archivo sin
    `capture` fijo para que el selector nativo ofrezca tanto cámara como
    galería. Modo "Comparar" con selección de hasta 2 fotos (la tercera
    reemplaza la más vieja) que abre `photo-comparison-view.tsx`: las dos
    fotos lado a lado y, debajo de cada una, el peso y % de grasa de la
    evaluación antropométrica más cercana en el tiempo (ventana de 14
    días — más allá de eso no se muestra dato, para no atribuirle a la
    foto una medición que ya no la describe). Borrado con confirmación
    inline de dos pasos (`photo-viewer.tsx`), mismo patrón que el resto
    de la app (nunca de un solo toque).
42. Vista del coach (`components/coach/client-progress-photos.tsx`), dentro
    de la pestaña "Evaluaciones" de `/coach/clients/[id]` junto a las
    evaluaciones del cliente — mismo componente de comparación
    (`photo-comparison-view.tsx`, reusado con la prop `coachView`). Ver
    ítem 45 (ago-2026) para la gestión completa que ganó después (subida,
    descarga, consentimiento) — al principio era de solo lectura.
43. Eliminación automática de Fase 10 (`deleteInactiveClient` en
    `supabase/functions/daily-checks`) ahora también borra los archivos
    del bucket `progress-photos` del cliente, mismo bloque que ya hacía
    esto para `nutrition-plans` (el DELETE en cascada de la fila borra el
    registro pero no el archivo físico del Storage).
44. Recordatorio mensual de fotos (migración
    `supabase/migrations/20260731_progress_photo_reminder.sql`, agrega
    `clients.progress_photo_reminder_dismissed_at`): banner arriba de la
    galería en `progress-photos-section.tsx`, mismo tratamiento visual que
    los avisos del dashboard del coach (`border-[#e8001c]/40
    bg-[#e8001c]/10`). Se dispara si pasaron 30+ días desde la última foto
    (`photos[0].takenAt`, ya viene ordenado por fecha desde
    `getProgressPhotosForClient`) o, si nunca subió ninguna, desde
    `clients.created_at` (`shouldShowPhotoReminder` en
    `lib/supabase/progress-photos.ts`) — salvo que lo haya descartado hace
    menos de 7 días (`dismissProgressPhotoReminder`, guarda el timestamp
    en vez de usar localStorage, mismo criterio que las preferencias del
    temporizador de descanso: tiene que sobrevivir entre dispositivos).
    Botón "Subir foto" del banner dispara el mismo `fileInputRef` que ya
    usa el flujo de subida normal, no duplica lógica. Se oculta solo al
    subir una foto (mismo punto donde se agrega la foto al estado
    optimista) o al descartarlo — en ambos casos de forma optimista en el
    cliente, sin esperar la respuesta del servidor. Sin push — es aviso
    puramente dentro de la app.
45. Gestión de fotos de progreso para el coach (ago-2026, migración
    `supabase/migrations/20260801_progress_photos_coach_and_consent.sql`,
    agrega `progress_photos.uploaded_by`):
    - **Subida del coach**: `app/coach/clients/[id]/photos-actions.ts`
      (`uploadClientProgressPhoto`) — mismo flujo que la subida del
      cliente (compresión, magic bytes) pero verificando `coach_id =
      auth.uid()` en vez de `client_id` del propio cliente. RLS de solo
      INSERT para el coach, tanto en `progress_photos` como en
      `storage.objects` — sin UPDATE ni DELETE, a propósito: el coach
      puede agregar fotos (útil en una evaluación presencial) pero nunca
      borrarlas ni tocar el consentimiento (ver ítem 46), eso sigue
      siendo 100% del cliente incluso a nivel de base de datos, no solo
      de UI.
    - **Quién la subió**: `progress_photos.uploaded_by` (`'client'` |
      `'coach'`) se muestra en el visor del cliente
      (`components/client/photo-viewer.tsx`) como "Subida por vos" /
      "Subida por tu coach" — el cliente necesita saber cuáles fotos
      cargó su coach durante una evaluación.
    - **Descarga**: botón en el visor individual del coach y en cada
      tarjeta de `photo-comparison-view.tsx` (prop `coachView`). `<a
      href={photoUrl} download>` sobre la URL firmada, mismo patrón que
      la descarga de PDFs de nutrición. Funciona igual sea cual sea el
      consentimiento del cliente (ver ítem 46) — el coach la necesita
      para su seguimiento de cualquier forma.
46. Consentimiento de uso público — simplificado (ago-2026, migración
    `supabase/migrations/20260802_simplify_photo_consent.sql`): arrancó
    siendo por foto (`progress_photos.public_use_authorized`, ítem 45
    original) y se reemplazó por UNA sola decisión en el cliente
    (`clients.photos_public_use_authorized`, nullable — `null` = todavía
    no respondió). La migración también le sacó la condición
    `public_use_authorized = false` al WITH CHECK de la policy de INSERT
    del coach (ya no existe esa columna) y borró la columna de
    `progress_photos`.
    - **Primera vez**: `components/client/photos-consent-modal.tsx` —
      se monta dentro de `progress-photos-section.tsx`, que a su vez solo
      se monta la primera vez que el cliente visita la pestaña "Mi
      Cuerpo" (`progress-tabs.tsx` ya maneja el "recién se monta al
      visitar", no hizo falta lógica extra para el "primera vez que
      entra"). Sin botón de cerrar — Sí/No sin preseleccionar, tiene que
      elegir.
    - **Revocable**: toggle en `/client/profile`
      (`components/client/photos-consent-toggle.tsx`), misma acción de
      servidor que el modal (`setPhotosPublicUseAuthorization` en
      `app/client/profile/actions.ts`) — sin push al cambiarlo.
    - **Vista del coach**: pill simple arriba de la galería en
      `client-progress-photos.tsx` — "Autoriza uso público" (verde,
      mismo criterio de color que los badges "Activo" de suscripción) o
      "No autoriza" (gris, cubre tanto `false` como `null` — un cliente
      que nunca respondió se trata como no autorizado, nunca al revés).
      Ya no hay distinción por foto individual en la grilla, el visor ni
      la comparación.
    - **Texto de privacidad**: en la sección de subida del cliente
      (`progress-photos-section.tsx`), simplificado a que las fotos son
      privadas — la explicación del consentimiento vive en el modal/
      toggle, no ahí.
47. Banner de bienvenida de rutina (ago-2026, migración
    `supabase/migrations/20260803_welcome_banner_and_warmup.sql`, agrega
    `routines.welcome_banner_shown_at`): pantalla completa en
    `/client/my-routine` (`components/client/routine-welcome-banner.tsx`),
    dispara tanto la primera vez que el cliente entra a Mi Rutina como
    cada vez que el coach le asigna una rutina nueva — ambos casos son en
    realidad el mismo chequeo (`welcome_banner_shown_at IS NULL` para la
    rutina activa), porque una rutina nueva siempre es una fila nueva con
    la marca en null. Se guarda en la base al tocar "Empecemos"
    (`dismissWelcomeBanner` en `app/client/my-routine/actions.ts`) — nunca
    localStorage, para que no vuelva a aparecer en otro dispositivo. Sin
    tap-afuera ni botón de cerrar a propósito (mismo criterio que
    `MonthlyGoalModal`): tiene que leer el mensaje y tocar el botón.
    - Saludo con género: usa `clients.sex` (`'male'`/`'female'`/null, ya
      existía desde la migración de antropometría) — "Bienvenido" /
      "Bienvenida" / "Bienvenido/a" si nunca se cargó.
    - "Primera rutina" vs. "rutina nueva": `isClientsFirstRoutine` en
      `lib/supabase/client-routine.ts` mira si existe CUALQUIER otra
      rutina para el cliente (activa o archivada) aparte de la actual —
      si no hay ninguna, es la primera de su vida y usa el mensaje
      "acá arranca tu proceso"; si hay, usa "nueva etapa".
48. Banner de calentamiento (mismo ago-2026, misma migración agrega
    `routine_exercises.warmup_type` y `.warmup_fixed_weight_kg`):
    - **Selector en el creador/editor de rutinas**
      (`app/coach/routines/new/routine-wizard.tsx` y
      `app/coach/routines/[id]/edit/routine-editor.tsx`) — 4 opciones:
      "Sin calentamiento" (default), "Porcentaje con kilos calculados",
      "Porcentaje del máximo", "Peso fijo" (habilita un campo de kg). Solo
      el PRIMER ejercicio que se agrega a un día nuevo arranca en
      "Porcentaje con kilos calculados" en vez de "Sin calentamiento" —
      es el único ejercicio para el que el banner llega a mostrarse, así
      que tiene sentido como default útil; el coach lo puede cambiar
      igual.
    - **Cálculo** (`components/client/warmup-banner.tsx`): Tipo A
      (`percentage_with_kg`) usa el peso objetivo que ya calcula
      `getWorkoutSuggestions` (`suggestions[exercise.id]?.weight`) — 50%
      × 5, 70% × 3, 90% × 1, redondeado al múltiplo de 2,5 kg más cercano
      **hacia abajo** (`Math.floor(kg / 2.5) * 2.5`, ej. 47,5kg → 50% =
      23,75 → se muestra 22,5kg). Si no hay peso sugerido (el cliente
      nunca hizo el ejercicio, o hace más de 8 semanas — mismo límite que
      la sugerencia normal), cae al mismo formato de solo-porcentaje que
      Tipo B. Tipo B (`percentage_of_max`) siempre en porcentaje, nunca
      calcula kilos aunque haya datos — para clientes avanzados que
      autorregulan. Tipo C (`fixed_weight`) siempre 3×8 con el
      `warmup_fixed_weight_kg` que cargó el coach, sin cálculo.
    - **Cuándo aparece**: en `workout-logger.tsx`, solo para el PRIMER
      ejercicio del día (`exerciseIndex === 0`), antes de cargar su
      primera serie (`currentSets.length === 0`), solo si ese ejercicio
      tiene un tipo de calentamiento distinto de `'none'`, y recién
      cuando terminó de cargar `getWorkoutSuggestions` (para no mostrar
      el fallback de porcentaje un instante y "corregirse" a kilos apenas
      llega el dato real). Se cierra con el botón o tocando afuera
      (`warmupBannerDismissed`, estado local — a diferencia del banner de
      bienvenida, acá no hay nada que persistir en la base: es puramente
      informativo y se vuelve a mostrar en la próxima sesión de
      entrenamiento).
    - Texto final ("Estas series NO se registran...") siempre presente,
      en los tres tipos; "Tanteá con un peso..." solo en Tipo B o en Tipo
      A sin datos.
49. Legibilidad en gimnasio (ago-2026) — tres ajustes sobre feedback real
    de uso, sin schema nuevo:
    - `workout-logger.tsx`: el detalle "3 series · 8-10 reps · RIR 3" (una
      sola línea `text-sm` gris) pasó a ser 2-3 tarjetas lado a lado con el
      número en Bebas Neue grande (`text-4xl`) y el label chico debajo —
      mismo patrón "número protagonista" que el resumen de sesión y las
      celebraciones, para que se lea de un vistazo con el teléfono apoyado
      mientras se entrena.
    - `app/client/my-routine/page.tsx`: la frase motivacional pasó de
      `text-sm text-[#888888]` a `text-xl` en blanco (`#f5f5f5`), más
      presencia visual sin agregar ningún elemento nuevo (nada de
      side-stripe ni card extra).
    - `rest-timer-bar.tsx`: el beep del temporizador (Web Audio API) casi
      no se escuchaba en el gimnasio — volumen pico subido de 0.35 a 0.75
      y ahora son DOS beeps cortos en vez de uno (`playSingleBeep` x2 con
      un gap de 0.28s), más perceptible que un tono único más largo. La
      vibración pasó de un pulso único (`[80, 60, 80]`, ~220ms) a un
      patrón de 3 pulsos repetidos (`[150, 100, 150, 100, 150]`, ~650ms).
50. Bug de adherencia — activación a mitad de mes (ago-2026): los días
    planificados del mes se contaban siempre desde el día 1, sin importar
    cuándo el cliente activó su acceso ni cuándo se le asignó la rutina —
    caso real: Ana Siani activó el 06/07 y el sistema mostraba 12/20
    (60%) en vez de 12/16 (75%).
    - `clients.access_activated_at` (nueva columna, migración
      `20260729_access_activated_at.sql`) — se escribe SOLO en la
      transición real a "active" (estaba inactivo/vencido/cancelado),
      nunca en una renovación o en cada cobro recurrente de PayPal, o el
      conteo se reiniciaría todos los meses. Dos puntos de escritura:
      `activateClientAccess` (`app/coach/clients/[id]/actions.ts`, chequea
      el status previo antes de pisar la fecha) y `updateClientStatus` del
      webhook de PayPal (`lib/paypal/webhooks.ts`, mismo chequeo — cubre
      tanto `BILLING.SUBSCRIPTION.ACTIVATED` como cada
      `PAYMENT.SALE.COMPLETED`). Backfill de clientes ya activos al correr
      la migración: `created_at` como mejor aproximación disponible (no
      existía ningún registro histórico previo) — si Luis conoce la fecha
      real de algún cliente puntual, se corrige a mano por SQL.
    - `lib/utils/planned-days.ts` (`plannedDaysInRange`, nuevo, sin
      dependencia de Supabase): arranca el conteo desde la fecha MÁS
      TARDÍA entre inicio del rango pedido, `access_activated_at`, y la
      asignación de la rutina activa (`routines.starts_at` si el coach lo
      cargó, si no `created_at`) — mismo criterio para ambas fechas, así
      una rutina asignada después de la activación tampoco cuenta días
      previos a que existiera.
    - Los 4 lugares que calculaban `plannedDaysPerWeek * semanas` a mano
      ahora usan el helper: `lib/supabase/stats.ts` (`getClientStats`,
      adherencia del dashboard del cliente y base de `month-summary.ts`),
      `lib/supabase/my-month.ts` (ventana bloqueada "Mi Mes"),
      `lib/supabase/month-summary.ts` (resumen de mes desbloqueado, más
      `prevPlannedDays` del mes anterior con el mismo criterio), y
      `app/client/log-workout/actions.ts`
      (`notifyCoachIfAdherenceCrossed80`, el push del 80% al coach). El
      dashboard del coach no calcula un % de adherencia propio (solo
      "sin entrenar 5+ días"), así que no había nada que tocar ahí.
51. Rediseño del selector de calentamiento (ago-2026) — los nombres
    describían el mecanismo interno ("Porcentaje con kilos calculados"
    vs. "Porcentaje del máximo") en vez de la decisión del coach, y las
    dos opciones de porcentaje no se distinguían de un vistazo.
    - `components/coach/warmup-type-selector.tsx` (nuevo, compartido por
      wizard y editor): lista vertical de 4 opciones tipo radio-card,
      SIEMPRE con su descripción visible debajo del nombre (nada de
      dropdown que esconde la diferencia) — "Sin calentamiento", "Guiado
      — le muestro los kilos" (para la mayoría), "Autorregulado — sin
      kilos" (para gente con experiencia), "Peso fijo — lo defino yo"
      (para principiantes o casos puntuales, revela el campo de kg
      dentro de la misma opción, solo si está seleccionada). Radio nativo
      oculto (`sr-only`) + `<label htmlFor>` hermano (mismo patrón ya
      usado en `monthly-goal-modal.tsx` para el 1-5 de motivación) — el
      estado seleccionado se calcula en JS (`value === opt.value`), no
      con `peer-checked` de Tailwind, porque el indicador visual (el
      punto del radio) vive anidado dentro del label y `peer-checked`
      solo alcanza hermanos directos, no descendientes de un hermano.
    - Nota "Este es el primer ejercicio del día..." arriba del selector,
      solo cuando `isFirstOfDay` (mismo criterio que ya decidía el
      default) — en el resto de los ejercicios el selector existe igual
      pero arranca en "Sin calentamiento" sin la nota.
    - Wireado en `routine-wizard.tsx` y `routine-editor.tsx`
      reemplazando el `NativeSelect` + input de peso suelto — mismos
      props (`warmupType`/`warmupFixedWeightKg`) y misma lógica de
      submit, solo cambió la presentación.

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
