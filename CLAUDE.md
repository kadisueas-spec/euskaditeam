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
**Ítems 19 y 20 (Mi Mes) reemplazados en oct-2026 por los reportes de
progreso (ítem 70)**: el resumen del mes ahora es el reporte mensual. El
modal del objetivo (18) y el cierre de mes (21) siguen igual.
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
    mes —sacado en oct-2026, ver ítem 70—, inactividad de 3 días) corren como Supabase Edge Functions
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
      primera activación (columna vacía; regla corregida en oct-2026, ver
      ítem 69), nunca en una renovación o en cada cobro recurrente de
      PayPal, o el conteo se reiniciaría todos los meses. Dos puntos de escritura:
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
52. Biblioteca de videos explicativos (ago-2026) — links de YouTube que el
    coach carga para explicar conceptos (RIR, calentamiento, técnica) o
    asignar material puntual a un cliente específico.
    - Schema (migración `20260730_videos.sql`): `videos` (coach_id, title,
      description, youtube_id, category, is_general), `video_assignments`
      (muchos-a-muchos video↔cliente, solo tiene filas si `is_general =
      false`), `video_views` (marca de "visto" por cliente — separada de
      las asignaciones porque un video general no tiene fila de
      asignación pero igual necesita rastrearse por cliente). Categorías
      fijas en `lib/constants/videos.ts`: Conceptos, Calentamiento,
      Movilidad, Técnica, Nutrición, Uso de la app.
    - `lib/supabase/videos.ts` (solo lectura, mismo split que
      exercises.ts/routines.ts) + `app/coach/videos/actions.ts`
      (escritura): `resolveYoutubeId` reusa `extractYouTubeId`
      (`lib/constants/youtube.ts`) igual que los ejercicios, pero acá el
      link SIEMPRE es obligatorio (a diferencia del video demostrativo de
      un ejercicio, que es opcional). Al guardar, `reconcileAssignments`
      borra todas las filas de `video_assignments` del video y las
      reemplaza por el set nuevo — más simple que diffear
      inserts/updates/deletes a mano, aceptable a esta escala (pocos
      clientes por video).
    - Panel del coach (`/coach/videos`, mismo patrón que
      `/coach/exercises`): lista con tabs de categoría y miniatura de
      YouTube, `video-form.tsx` compartido entre crear/editar (toggle
      General/Asignado — al elegir Asignado se muestra un checklist de
      clientes, `getClientsForSelect` ya existente), `delete-video-button.tsx`
      con confirmación (mismo patrón que `delete-routine-button.tsx`).
    - Push SOLO cuando un cliente queda asignado por primera vez a un
      video no general (texto fijo pedido: "Tu coach te dejó un video:
      [título]", `lib/constants/push-copy.ts`) — nunca al guardar sin
      cambios ni a los videos generales. `reconcileAssignments` devuelve
      los client_id que NO estaban antes en la asignación, y solo a esos
      se les manda `sendPushToClient`.
    - Vista del cliente (`/client/videos`, enlazada desde una card
      destacada en `/client/profile` con badge de no vistos — se optó por
      el perfil en vez de un 7º ítem en `ClientBottomNav` para no
      recargar la nav de 6 ítems en mobile): sección "Para vos" primero
      con los asignados puntualmente, después agrupado por categoría con
      los generales. Badge "Nuevo" por `video_views` faltante.
      `/client/videos/[id]` reusa `ExerciseVideo` para el embed (el video
      siempre tiene youtube_id, a diferencia de un ejercicio sin video
      cargado) y marca "visto" con `MarkVideoSeenOnMount` — mismo patrón
      que `MarkReadOnMount` de feedback (Server Action separado de la
      lectura de la página, para poder `revalidatePath("/client",
      "layout")` y que el badge del perfil se actualice al toque, sin
      esperar un refresh completo).
53. Nueva pantalla de inicio del cliente (ago-2026) — reemplaza a Mi Rutina
    como primera pantalla al abrir la app. Objetivo: que el cliente vea de
    un vistazo qué le toca hoy y todo lo que incluye su plan (antes entraba
    directo a una lista de días de rutina y nunca veía el conjunto).
    - `lib/supabase/client-home.ts` (`getClientHomeData`): una sola
      función que junta todo en paralelo (`Promise.all`) — rutina activa,
      stats (racha/adherencia), última evaluación antropométrica, plan de
      nutrición activo, fotos de progreso, videos, y dos consultas nuevas
      (conteo total de entrenamientos completados, y si ya entrenó HOY con
      su resumen de series/kilos). Nada de una query por tarjeta.
    - `trainedToday` tiene prioridad sobre `suggestedDay` aunque queden
      otros días planificados sin completar esta semana — un cliente pudo
      adelantar el día de mañana hoy y de todos modos ya entrenó HOY.
      `NextWorkoutCard` (`components/client/next-workout-card.tsx`) ganó
      este tercer estado ("Ya entrenaste hoy 🔥" + resumen) además de los
      dos que ya tenía (día sugerido / semana completa) — mismo
      componente, movido de Mi Rutina a la pantalla de inicio.
    - `components/client/plan-card.tsx` (nuevo): las 6 tarjetas del plan
      (Mi Rutina, Nutrición, Mi Cuerpo, Fotos de Progreso, Videos, Mi
      Progreso) SIEMPRE se muestran, tengan dato o no — la tarjeta vacía
      invita ("Tu primera evaluación está por venir") en vez de decir "sin
      datos", solo más tenue visualmente (borde/ícono/texto apagados, sin
      el glow rojo). Es la diferencia entre un menú y un panel que
      comunica el valor de la asesoría integral.
    - El banner de bienvenida de rutina (`RoutineWelcomeBanner`) se movió
      de `/client/my-routine` a esta pantalla — es el punto de entrada
      real ahora, my-routine pasó a ser una pantalla secundaria (solo
      nombre/objetivo/lista de días, sin saludo ni frase ni racha, todo
      eso vive acá).
    - Ruteo: `app/login/actions.ts`, `app/login/page.tsx` y
      `app/coach/layout.tsx` (fallback si un cliente cae en rutas de
      coach) ahora redirigen a `/client/home` en vez de
      `/client/my-routine`; `app/client/error.tsx` también. El bottom nav
      (`ClientBottomNav`/`CLIENT_NAV_ITEMS`) NO cambió — "Mi Rutina" sigue
      ahí tal cual, solo cambió dónde aterriza el cliente al entrar (no
      hay un ícono de "Inicio" nuevo, a propósito, para no sumar un 7º
      ítem a una barra que ya tiene 6). **Reemplazado en oct-2026 por el
      ítem 56** (nav de 5 con Inicio).
54. "La app explica lo que hace" (ago-2026) — el cliente usaba funciones
    sin saber que existían (un número sugerido, un % de grasa) sin saber
    de dónde salían. Explicaciones breves, SOLO cuando algo sucede (nunca
    avisos sueltos), atribuidas al coach y no a "la app", texto chico gris
    que nunca compite con el dato — sin íconos de info ni tooltips.
    - Sugerencia de peso/reps de la primera serie
      (`app/client/log-workout/workout-logger.tsx`): `WorkoutSuggestion`
      (actions.ts) ganó el campo `recordDate` (antes solo existía
      `weeksAgo`, un conteo — hacía falta la fecha real de
      `workout_logs.workout_date` de la sesión de referencia para poder
      decir "Calculado desde tu récord del [fecha]"). Debajo de la
      insignia ámbar ya existente (que sigue igual), una segunda línea
      con el dato crudo + el porqué — solo con dato fresco
      (`weeksAgo < 2`, para no apilarse con el aviso de "hace X semanas"
      que ya se explica solo): "Llegaste al tope del rango la vez
      pasada..." para `weight_increase`, "Con la fatiga cae el
      rendimiento..." para `reps_increase`.
    - Calentamiento (`components/client/warmup-banner.tsx`): "Calculado
      sobre tu peso objetivo de hoy." — solo en Tipo A con dato real
      (`percentage_with_kg` con kilos calculados); Tipo B es porcentaje
      que el cliente aplica solo y Tipo C es un peso que cargó el coach a
      mano, ninguno de los dos "se calcula".
    - Evaluación antropométrica (`components/client/body-tab.tsx`): junto
      al % de grasa, "Medido con protocolo {PROTOCOL_LABELS[protocol]}"
      (reusa el label ya existente en `lib/anthropometrics/constants.ts`,
      que ya incluye el nombre y la cantidad de pliegues — no hacía falta
      recalcular nada aparte). Al pie de toda la sección: "No es una
      balanza: es una medición con fórmula validada."
    - Gráficos: `EvolutionChart` (`components/charts/evaluation-
      evolution-chart.tsx`) y `ExerciseProgressCharts`/`SingleMetricChart`
      (`components/charts/exercise-progress-charts.tsx`) ganaron un
      footnote opcional (`footnote`/`showExplanations`) — opt-in porque
      ambos componentes son COMPARTIDOS con las vistas del coach
      (`client-body-analysis.tsx`, `client-weight-chart.tsx`,
      `client-metrics-tab.tsx`, `app/coach/profile`), que no lo pasan (el
      coach no necesita que le expliquen su propia herramienta). Solo se
      muestra con curva real (`points.length >= 2`, mismo gate que el
      chart). Cada gráfico tiene su propia frase (nunca la misma dos
      veces en la misma pantalla de Mi Cuerpo): peso corporal, % grasa,
      masa muscular, perímetro, peso del día a día (`weight-tab.tsx`),
      peso máximo y peso promedio por ejercicio (`stats-charts.tsx`, con
      `showExplanations`).
    - Racha (`components/client/stats-charts.tsx`): junto a "Racha de
      días 🔥", "Los días de descanso programados también suman: son
      parte del plan." — no se agregó en la fila compacta de estado de
      `/client/home` (Parte 1) para no romper el formato de una sola
      línea que pedía esa pantalla.
    - Plan de nutrición (`components/client/nutrition-tab.tsx`): debajo
      del botón "Descargar PDF", "Armado según tus objetivos y lo que te
      gusta comer." — siempre visible junto al botón (no literalmente "al
      tocar descargar", ya que el formato pedido es visible siempre sin
      tener que tocar nada).
    - Feedback recibido (`app/client/feedback/[id]/page.tsx`): "Tu coach
      revisó tus sesiones de esta semana." debajo del mensaje, una sola
      vez en el detalle (no en la lista, para no repetirlo por cada
      ítem).
55. Hora de Paraguay (oct-2026) — "hoy" se calculaba en UTC
    (`new Date().toISOString().slice(0, 10)` / `getUTC*`), así que desde
    las 21hs de Paraguay ya era "mañana": entrenamientos guardados con la
    fecha del día siguiente, y adherencia/rachas/mes/objetivo mensual
    cambiando de día 3 horas antes.
    - `lib/utils/today.ts`: `todayInParaguay()`, `paraguayNow()` (Date
      corrido -3h — sus campos UTC dan la hora de pared de Paraguay, así
      la lógica existente con `getUTC*` no se reescribió, solo cambia de
      dónde sale el "ahora"; NUNCA usarlo como instante real para guardar
      un timestamptz), `paraguayDateOf()` (fecha de Paraguay de un
      timestamptz; un DATE puro pasa sin cambios) y
      `startOfParaguayDayMs()`. **Offset fijo UTC-3, no
      `America/Asuncion`**: Paraguay abolió el horario de verano en
      oct-2024, y un Node/ICU con tzdata anterior a 2024b aplicaría UTC-4
      de marzo a octubre. Cualquier cálculo nuevo de "hoy"/semana/mes
      tiene que pasar por este helper.
    - Vencimiento de acceso (`lib/constants/access.ts`): el acceso se
      corta a las 00:00 de Paraguay del día elegido (antes, 21hs del día
      anterior) — mismo criterio que `daily-checks`, que ese día lo pasa
      a `inactive`.
    - Edge Functions sin cambios a propósito: corren a las 10am PYT,
      cuando fecha UTC y fecha de Paraguay coinciden.
    - Datos viejos: corrección por SQL en el SQL Editor (7 sesiones y 2
      pesos cargados entre 21:00 y 23:59 con fecha corrida). 5 sesiones quedaron sin
      corregir porque chocan con `workout_logs_client_day_date_key`
      (ya existe otra sesión del mismo día de rutina en la fecha
      correcta) — pendientes de revisión manual: `cb00c397`, `f2f91709`,
      `6fbd16ab` (Ana Siani), `0f8277c4` (Raquel González), `6c3cde89`
      (Sebastián Candia).
56. Bottom nav del cliente de 5 ítems (oct-2026): Inicio · Rutina · Mi
    Cuerpo · Progreso · Perfil (`client-nav-items.ts`, con `matches` para
    resaltar la sección "dueña" de rutas que salieron de la nav).
    - Entrenar salió de la nav: se entra desde `NextWorkoutCard` en
      Inicio (que con una sesión abierta pasa a "Continuar
      entrenamiento") o desde un día en Rutina. Barra fija "Entrenamiento
      en curso" (`components/client/active-workout-bar.tsx`) arriba de la
      nav en cualquier pantalla menos Entrenar, con
      `getActiveWorkoutSession` (`is_completed = false` de hoy). El layout
      no se re-renderiza al navegar, así que la barra vuelve a pedir el
      dato con una server action en cada cambio de ruta.
    - Mi Cuerpo es pantalla propia (`/client/body`: Medidas, Peso,
      Nutrición — antes pestañas de Progreso). `ProgressTabs` pasó a ser
      genérico (`tabs: {key,label,content}[]`). Progreso quedó con el
      historial + botones Estadísticas y Mi Mes. Links viejos
      `/client/progress?tab=cuerpo|peso|nutricion` redirigen a
      `/client/body?tab=...` (push ya enviados).
    - Mi Mes pasó a Progreso; Feedback a una tarjeta en Perfil (el badge
      de no leídos ahora va sobre el ícono de Perfil).
57. Ficha del cliente reorganizada (oct-2026) — el Resumen de
    `/coach/clients/[id]` era un scroll larguísimo: para dejar feedback o
    hacer el cierre de mes había que pasar por Acceso/PayPal.
    - Orden nuevo, abiertos: Últimos entrenamientos → Dejar feedback →
      Rutina activa. Colapsados abajo (`components/coach/collapsible-card.tsx`,
      `<details>` nativo con un resumen siempre visible en el título):
      Feedback dejado (cantidad), Cierre de mes (Completado/Sin hacer),
      Datos y notas, Acceso y pagos (estado · método · vencimiento) —
      "Eliminar cliente" vive adentro de Acceso y pagos.
    - Línea de estado bajo el nombre: badge de acceso, vencimiento y rutina
      activa, sin abrir nada.
    - Cierre de mes: el último día del mes y si falta hacerlo
      (`isMonthEndToday` + `review.completedAt`), sube primero y abierto —
      mismo criterio que la alerta del dashboard.
    - Rutina activa ganó `RoutineQuickActions`: "Nueva rutina"
      (`/coach/routines/new?client=<id>`), "Copiar a otro cliente"
      (`?from=<routineId>&client=<destino>` — el wizard precarga todo con
      `daysFromSource`, solo LEE la rutina de origen, saltea ejercicios
      borrados de la biblioteca y avisa cuántos) y "Guardar como plantilla"
      (`copyRoutineAsTemplate` en `app/coach/routines/template-actions.ts`,
      ver ítem 58).
    - `lib/supabase/routine-tree.ts` (`insertRoutineDays`): inserción de
      días + ejercicios compartida por `createRoutine` y las plantillas.
58. Plantillas de rutinas (oct-2026, migración
    `20261015_routine_templates.sql`): una plantilla es una fila más de
    `routines` con `is_template = true` — mismo árbol de
    `routine_days`/`routine_exercises` y mismo RLS ("Coach manages
    routines" ya filtra por `coach_id`; las policies del cliente filtran
    por `client_id`, NULL en una plantilla). Hace falta la columna aparte
    porque `client_id NULL` ya lo usan las rutinas de Mi Entrenamiento del
    coach. CHECK `routines_template_shape`: una plantilla no tiene
    cliente, ni `starts_at`/`ends_at`, y nunca es activa — por eso queda
    afuera sola de `daily-checks` (sin redeploy), de Mi Entrenamiento y de
    `routines_one_active_per_client`. Una plantilla no depende de ningún
    cliente: sobrevive al borrado en cascada de la eliminación del día +5.
    - Lectura: `lib/supabase/routine-templates.ts` (`getTemplatesList`).
      `getRoutinesList` filtra `is_template = false`.
    - `/coach/routines?tab=plantillas`: nombre, días, ejercicios,
      objetivo; Usar / Editar / Eliminar (`template-list-item.tsx`).
    - Crear: botón "Guardar como plantilla" en el paso 3 del wizard
      (`createTemplate`, cliente y mesociclo pasan a ser obligatorios
      recién al asignar) o desde la Rutina activa de un cliente
      (`copyRoutineAsTemplate`, ítem 57). Ambas borran la plantilla
      parcial si falla la inserción de días.
    - Usar: paso 0 del wizard ("Desde cero" o una plantilla) cuando hay
      plantillas y no se llegó con `?from=`; elegir navega a `?from=<id>`
      (el wizard lleva `key={from}` para remontarse con el estado nuevo).
      La plantilla solo se lee — la rutina se crea con `createRoutine`.
    - Editar/renombrar: el mismo `RoutineEditor`; con `isTemplate` oculta
      mesociclo y fecha de inicio, y `updateRoutine` no los valida ni
      escribe (el CHECK rechazaría `starts_at`).
59. Progresión serie a serie (oct-2026): de la serie 2 en adelante, la
    sugerencia sale de la última serie completada de ESTA sesión, no de la
    semana pasada (la serie 1 sigue con `getWorkoutSuggestions`).
    - `lib/utils/set-progression.ts` (`suggestNextSet`, función pura, sin
      Supabase — corre en el teléfono, funciona offline). Con P = peso,
      R = reps de la serie anterior: R > máx → mismo peso, reps = máx;
      R en rango y R−1 ≥ mín → mismo peso, R−1; R−1 < mín o R < mín →
      P − `weight_increment`, reps = máx. RIR sugerido = `rir_target`
      (vacío si no hay). Si la sesión anterior tuvo menos series que hoy,
      las extra salen igual de la última serie de hoy (sin caso aparte).
    - Redondeo hacia abajo a 2,5 kg solo en los casos que bajan el peso
      (en "mismo peso" P queda tal cual) y solo si el incremento es
      múltiplo de 2,5 — si no (mancuernas de a 1 kg), al múltiplo del
      propio incremento (22 − 1 = 21, no 20).
    - Sin peso para bajar (peso corporal, o P − incremento ≤ 0): mismo
      peso, mismas reps, "Mantené la técnica, hacé las que puedas". Un
      solo extremo del rango cargado vale como mín y máx; sin rango,
      repite la serie anterior sin texto de caso.
    - `workout-logger.tsx`: mismo efecto que la sugerencia de la serie 1,
      recalcula también si cambia la última serie (`lastSetKey`). Mismo
      recuadro ámbar; texto "Según tu serie anterior: P kg × R reps" +
      explicación del caso en gris (`SET_PROGRESSION_TEXT`), en cada serie.
    - `weight_increment` ahora llega al logger (`MyRoutineExercise.
      weightIncrement`, en `client-routine.ts` y `coach-training.ts` — el
      entrenamiento propio del coach reusa el mismo logger).
60. Temporizador de descanso v2 (oct-2026, migración
    `20261016_rest_timer_push_token.sql`):
    - Posición: la barra fija abajo tapaba "Anterior"/"Siguiente
      ejercicio". Ahora es `sticky top-0` arriba de todo en el logger
      (`rest-timer-bar.tsx`): ocupa lugar propio en el flujo, nunca tapa un
      botón y sigue visible al scrollear.
    - Sonido: timbre tipo teléfono de ~2,4 s (dos "rrring" de 1,1 s,
      ondas cuadradas 1000 + 1200 Hz con trino de 20 Hz, ganancia máxima a
      través de un `DynamicsCompressor`). En iOS el audio de una PWA se
      suspende en segundo plano — limitación del sistema, no se resuelve
      desde la app.
    - Push "⏱ Terminó el descanso" (`REST_END_PUSH`), para la pantalla
      bloqueada: Web Push no tiene envío programado, así que
      `scheduleRestEndPush` (`app/client/log-workout/rest-push-actions.ts`)
      guarda un token en `clients.rest_timer_push_token` y espera dentro
      de `after()` hasta el fin del descanso (+0,5 s de margen); manda la
      push solo si el token sigue siendo el suyo (lo consume en el mismo
      UPDATE). Se reprograma con token nuevo al arrancar, al volver a la
      pantalla y con −15s/+15s (y una serie nueva reemplaza el descanso
      anterior). Se manda SIEMPRE al llegar a 0:00 — con la app abierta,
      tras cambiar de ejercicio o terminar el entrenamiento también; la
      única forma de cancelarla es "Saltear" (`onSkip`). Solo si
      `Notification.permission === "granted"`. Tope: descansos de más de
      280 s no se avisan por push (`maxDuration = 300` en
      `app/client/log-workout/page.tsx`). `tag: "rest-timer"` + `renotify`
      en el SW: la nueva reemplaza a la anterior. El entrenamiento propio
      del coach no tiene push (no pasa estas acciones — no tiene fila en
      `clients` para el token).
    - Nota en `/client/profile` (`rest-timer-settings.tsx`): "En iPhone: el
      sonido solo funciona con la app abierta. Activá las notificaciones
      para recibir el aviso cuando termina el descanso."
61. Autoguardado del creador de rutinas (oct-2026) — sin schema, solo
    localStorage (`lib/utils/routine-draft-storage.ts`, key
    `routine-wizard-draft:<coachId>`, un borrador por coach).
    - `routine-wizard.tsx`: guarda todo el estado editable (paso actual,
      paso 1, días y ejercicios con su configuración completa) con
      debounce de 400 ms en cada cambio. Un wizard vacío (o con un solo
      día vacío) no cuenta como borrador (`draftHasContent`).
    - Al abrir: si hay borrador, aviso "Tenés un borrador sin terminar.
      ¿Continuarlo?" con Continuar / Descartar. Mientras el aviso está a
      la vista NO se autoguarda (no pisa el borrador con el wizard nuevo).
      El borrador se lee en un efecto después de hidratar (localStorage no
      existe en el render del servidor).
    - Se borra al guardar con éxito (asignar o "Guardar como plantilla"),
      al tocar Descartar, o con el botón "Cancelar" del wizard
      (confirmación inline "¿Descartar lo cargado y salir?").
      `draftClosedRef` evita que un guardado pendiente del debounce lo
      vuelva a escribir después.
62. Emails de Auth por dominio propio + recuperación de contraseña
    (oct-2026). El código NO manda emails por su cuenta (no hay SDK de
    Resend ni `RESEND_FROM_EMAIL` en uso): todos los emails son de
    Supabase Auth, enviados por Custom SMTP de Resend configurado en el
    Dashboard (Authentication → Emails → SMTP Settings: host
    `smtp.resend.com`, puerto 465, usuario `resend`, password = API key,
    remitente `@euskaditeam.app`).
    - Login (`app/login/actions.ts`): `email_not_confirmed` → "Confirmá tu
      email antes de entrar..." en vez del genérico. Avisos por
      `?notice=reset|confirmed|link` (`LOGIN_NOTICES` en
      `app/login/page.tsx`).
    - `/forgot-password`: pide el email y llama `resetPasswordForEmail`
      con `redirectTo` = `/auth/confirm?next=/reset-password`. Responde
      siempre "te mandamos el email" (no revela qué cuentas existen);
      solo distingue el rate limit.
    - `/auth/confirm` (route handler): acepta `token_hash`+`type`
      (`verifyOtp`) o `code` (`exchangeCodeForSession`, PKCE); `next`
      solo rutas internas. Si falla → `/forgot-password?expired=1` (o
      `/login?notice=link`).
    - `/reset-password`: con la sesión que dejó `/auth/confirm`,
      `updateUser({ password })` sin pedir la actual; después `signOut` y
      `/login?notice=reset` (el link suele abrirse en el navegador, no en
      la PWA).
    - **Plantilla de email recomendada** (Dashboard → Authentication →
      Emails → Reset Password): `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
      Con la plantilla por defecto (`{{ .ConfirmationURL }}`, flujo PKCE)
      solo funciona si el link se abre en el mismo navegador que lo pidió —
      en iPhone la PWA y Safari no comparten cookies. Ídem "Confirm
      signup" (opcional): `...?token_hash={{ .TokenHash }}&type=email&next=/login?notice=confirmed`.
      Redirect URLs del Dashboard tienen que incluir `<dominio>/auth/confirm`.
63. Récords: RIR corregido, prioridad por impacto y lista completa
    (oct-2026, `lib/utils/session-records.ts`).
    - Bug RIR invertido: `detectWeeklyRecord` premiaba MENOS RIR. Ahora
      récord de RIR = mismo peso y mismas reps con MÁS RIR que antes (le
      sobró más con el mismo trabajo → más fuerte). Guarda `rirDelta` y
      `previousRir` para el texto ("RIR 1 → 3").
    - `isBetterSet` (peso > reps > más RIR) es el único criterio de "mejor
      serie": lo usan `bestSetByExercise` (récords semanales y de Mi Mes)
      y la referencia de la serie 1 en `getWorkoutSuggestions`. Antes el
      empate de peso y reps ignoraba el RIR.
    - Orden por impacto (`compareRecordsByImpact`): 1º subida de peso, 2º
      más reps, 3º más RIR; dentro de cada tipo, la mejora más grande
      primero. `summarizeSessionRecords` devuelve TODOS los ejercicios con
      récord (uno por ejercicio, el más impactante) ya ordenados — resumen
      de sesión, celebración semanal y Mi Mes.
    - Celebración semanal (`weekly-celebration.tsx`): antes solo mostraba
      la cantidad; ahora lista todos los récords de la semana (con scroll
      propio).
    - Ejercicios nuevos (migración `20261017_abdomen_cardio_exercises.sql`):
      15 de abdomen ("Abdomen/Core") y 11 de cardio ("Cardio" — el grupo
      que ya existía), con video de YouTube. Propios del coach, no
      globales, para poder cambiar el video desde la app.
64. GIFs animados de ExerciseDB (oct-2026, migración
    `20261017b_exercise_gif_url.sql`, agrega `exercises.gif_url`).
    - Fuente: ExerciseDB V1 libre, `https://oss.exercisedb.dev/api/v1`
      (la URL vieja `exercisedb-api.vercel.app` está dada de baja). Los GIFs
      se copiaron al bucket público `exercise-gifs` de Supabase Storage
      (`exercisedb/<id>.gif`) con `scripts/import-exercise-gifs.mjs` — se
      corre a mano con la service role key en variables de entorno, es
      idempotente, saltea los GIFs que dan 404 y los lista al final. No se
      linkean directo a `static.exercisedb.dev` para no depender de que
      siga arriba. Algunos IDs del catálogo dan 404: el mismo ejercicio
      suele estar repetido con otro ID que sí funciona.
    - Mapeo por nombre (ES → EN) revisado a mano contra el músculo objetivo
      de ExerciseDB (ej. "cable kickback" es de tríceps, no glúteo). 110
      ejercicios con GIF; sin GIF a propósito (no hay equivalente):
      Plancha frontal / Plancha abdominal, Hollow body hold, Dragon flag,
      Remo ergométrico, Patada de glúteo en cuadrupedia.
    - Pantalla de Entrenar (`components/client/exercise-demo.tsx`, en
      `workout-logger.tsx`): GIF → video de YouTube → nada (sin el
      placeholder "próximamente"). GIF sobre fondo `#F5F5F5` (la silueta
      es negra), 220px de alto, ancho completo; si no carga cae al video.
      `gifUrl` en `MyRoutineExercise` (`client-routine.ts`,
      `coach-training.ts`). Mi Rutina y Mi Entrenamiento siguen con el
      video solo.
    - Pendiente antes de producción: revisar los términos de uso de los
      GIFs de ExerciseDB (el código es AGPL; los medios tienen ToS propio).
65. Fixes de oct-2026 (Entrenar, banner, subidas):
    - Mi Rutina (`app/client/my-routine/page.tsx`) usa `ExerciseDemo`
      igual que Entrenar: GIF → YouTube → nada.
    - Ejercicio completo en Entrenar: al volver con "Anterior" a un
      ejercicio con todas sus series hechas se mostraba el formulario
      (autocompletado por la progresión serie a serie) y un toque agregaba
      una serie de más. Ahora `exerciseDone` (`currentSets.length >=
      exercise.sets`) reemplaza formulario + "Completar serie" por
      "Ejercicio completo ✓" (las series se siguen pudiendo editar), y
      `handleCompleteSet` corta si ya está completo.
    - Temporizador: "Anterior"/"Siguiente ejercicio" ya no llaman a
      `clearRestTimer()` — el descanso sigue visible y corriendo en
      cualquier ejercicio. Se cierra solo con "Saltear", con una serie
      nueva o al terminar el entrenamiento.
    - Banner de bienvenida (una vez POR RUTINA, a propósito): la marca
      nunca se guardaba porque el cliente no tiene policy de UPDATE sobre
      `routines` (solo SELECT) — el UPDATE no daba error, tocaba 0 filas.
      `dismissWelcomeBanner` verifica la propiedad con la sesión del
      cliente y escribe solo `welcome_banner_shown_at` con el service
      role, exigiendo 1 fila actualizada. No se agregó policy de UPDATE
      para el cliente (podría tocar cualquier columna de su rutina).
    - Subidas (fotos de progreso, PDFs de nutrición): son Server Actions y
      su cuerpo tenía el tope default de 1 MB — todo PDF de más de 1 MB
      fallaba. `experimental.serverActions.bodySizeLimit = "4mb"` en
      `next.config.ts` (Vercel corta a 4,5 MB) y `MAX_UPLOAD_BYTES` (4 MB,
      `lib/constants/uploads.ts`) en las 3 acciones y en el navegador
      antes de enviar, con mensaje claro (peso real + máximo). Fotos: si
      `compressImage` falla, mensaje propio en vez del genérico. Para
      archivos de más de 4 MB habría que subir directo al Storage con URL
      firmada de subida.
66. Recorrido de bienvenida (oct-2026, migración
    `20261020_onboarding_tour.sql`: `routines.tour_home_seen_at` y
    `.tour_workout_seen_at`). Una vez POR RUTINA y por parte; sin backfill a
    propósito — los clientes que ya usaban la app también lo ven.
    - Dos partes, no un recorrido que navega solo: abrir Entrenar crea una
      sesión real "en curso" (`getOrCreateInProgressWorkout`), así que el
      recorrido no puede llevar al cliente ahí. Parte Inicio
      (`components/client/home-tour.tsx`): entrenamiento del día → bottom
      nav → Mi Cuerpo → cierre "¡Listo!". Parte Entrenar (en
      `workout-logger.tsx`, prop `workoutTour` que solo pasa
      `app/client/log-workout/page.tsx`): sugerencia/campos de la serie →
      RIR → Completar serie. Arranca la primera vez que el cliente entra a
      entrenar por su cuenta, cuando cargaron las sugerencias, sin el banner
      de calentamiento encima y con el ejercicio sin completar.
    - Sin sugerencia (primera sesión, sin historial) el paso 1 de Entrenar
      cambia de texto: explica qué va a aparecer ahí desde la próxima vez
      (`workoutTourSteps(hasSuggestion)`, `lib/constants/onboarding-tour.ts`).
    - Va después del banner "Empecemos": el banner dispara
      `WELCOME_BANNER_CLOSED_EVENT` al cerrarse y la parte Inicio lo espera.
    - `components/client/onboarding-tour.tsx`: overlay + recorte del
      elemento `[data-tour="..."]` (box-shadow 0 0 0 9999px + borde/glow
      rojo pulsante), re-medido en cada frame con `getBoundingClientRect`;
      tarjeta `#111111` con línea roja arriba, Bebas Neue/DM Sans, puntos de
      progreso, "Continuar"/"Saltar", Escape cierra. Pasos cuyo elemento no
      está en pantalla se saltean. Animaciones CSS (`animate-tour-*` en
      `globals.css`, desactivadas con reduced-motion).
    - Ajuste oct-2026 (probado en iPhone): se renderiza en un **portal a
      `body`** — dentro de la página, el `transform` que deja la animación
      de `PageTransition` hacía que el `position: fixed` se ubicara respecto
      del contenido que scrollea y la tarjeta quedaba fuera de la pantalla.
      `cardTop()`: debajo del elemento si entra, si no arriba, y si no entra
      de ningún lado se acota a la pantalla (nunca afuera); respeta el área
      segura (medida con un div de prueba con `env(safe-area-inset-*)`).
      Avance: "Continuar" o deslizar (izquierda = siguiente, derecha =
      anterior, solo gestos claramente horizontales); tocar afuera ya NO
      avanza. Verificado con Playwright/WebKit en 375×667 y 430×932, los 7
      pasos de las dos partes.
    - Se marca visto apenas aparece el primer paso (`markTourSeen` en
      `app/client/onboarding-actions.ts`, service role tras verificar que
      la rutina es del cliente — sin policy de UPDATE, igual que el banner):
      cerrarlo a mitad o cerrar la app no lo vuelve a mostrar.
67. Editor de rutinas (`app/coach/routines/[id]/edit/routine-editor.tsx`,
    oct-2026; el wizard de creación no cambió):
    - Drag & drop con `@dnd-kit/core` + `@dnd-kit/sortable`: días entre
      sí, ejercicios dentro de un día y entre días. Siempre desde el ícono
      de agarre (`DragHandle`, 44x44, `touch-none`) para que el resto
      scrollee normal en iPhone; `MouseSensor` + `TouchSensor` (delay
      120ms), no `PointerSensor` (compite con el scroll en iOS). Un
      ejercicio sobre otro día abierto se mueve en vivo; sobre un día
      colapsado o vacío se suelta al final de ese día (borde rojo de
      destino). `DragOverlay` en portal a `body` (los `FadeIn` dejan un
      transform que descoloca un `position: fixed`).
    - Días minimizables (solo visual, no se guarda): abierto solo el
      primero; tocar el encabezado alterna; colapsado muestra la cantidad
      de ejercicios. Un día nuevo se agrega abierto.
    - Barra fija arriba (`sticky top-0`) con "Guardar" y el error, además
      del botón del final.
    - `updateRoutine` (`app/coach/routines/actions.ts`): (1) ejercicios
      existentes se buscan en toda la rutina, no día por día — un ejercicio
      movido de día se actualiza (`day_id` incluido) y conserva su id e
      historial, en vez de insertarse como nuevo y dejar el original
      duplicado si tenía series; (2) primero se guardan/mueven días y
      ejercicios y recién después se borra lo que el coach sacó (si no, el
      CASCADE de un día borrado se llevaba ejercicios movidos fuera de él);
      (3) **edición silenciosa**: ya no manda push al cliente — antes cada
      guardado mandaba "nueva rutina"; la push queda solo en
      `createRoutine` (asignar un bloque nuevo).
68. Subidas a Storage que fallaban (oct-2026, encontradas con un modo
    debug temporal que mostraba el error crudo de Storage/Postgres en
    pantalla — commit `f8f7e4f`, ya revertido; si vuelve a pasar algo
    parecido, revertir ese revert es la forma rápida de diagnosticar):
    - PDF de nutrición: `StorageApiError · Invalid key · 400`. El path era
      `<client_id>/<uuid>-<nombre original>` y Storage rechaza tildes, ñ y
      algunos símbolos. Ahora `<client_id>/<uuid>.pdf`; el nombre original
      sigue en `nutrition_plans.file_name` y se aplica a la descarga con
      `createSignedUrl(..., { download: file_name })` (el atributo
      `download` del `<a>` no sirve en URLs de otro dominio). Regla: nunca
      usar el nombre que manda el usuario dentro de un path de Storage.
    - Fotos de progreso: `Bucket not found · 404` — el bucket
      `progress-photos` no existía en el proyecto (creado a mano: privado,
      8 MB, jpeg/png; las policies de `storage.objects` ya estaban).
69. Adherencia: activación y días planificados (oct-2026).
    - `access_activated_at` solo se escribe si está vacía
      (`shouldSetAccessActivatedAt`, `lib/utils/access-activation.ts`, en
      `activateClientAccess` y en el webhook de PayPal). Antes se escribía
      si el estado previo no era "active" — pero `daily-checks` pasa a
      `inactive` el mismo día que vence, así que renovar horas después
      contaba como reactivación y reiniciaba la fecha (Luz Aranda quedó
      con 29/09 entrenando desde julio). Una reactivación real tras una
      baja larga no existe: al día +5 el cliente se elimina. Datos de los
      14 clientes afectados corregidos a mano por SQL (fecha de su primera
      sesión, medianoche de Paraguay).
    - `plannedDaysInRange`: `plannedPerWeek × días reales / 7`, redondeado,
      en vez de redondear semanas para arriba (`Math.ceil(días / 7)`, que
      daba 20 días para septiembre con 4 por semana en vez de 17). Los
      días de rutina no están atados a un día de la semana (solo
      `day_number` = orden), por eso es proporcional. Lo usan los 4
      cálculos de adherencia del ítem 50.
    - Día entrenado = sesión finalizada CON al menos 1 serie
      (`lib/utils/training-sessions.ts`: `TRAINING_SESSION_SELECT` trae el
      conteo de series embebido, `trainedDates`, `adherencePercent`). Lo
      usan los 4 cálculos de adherencia (stats, Mi Mes, resumen de mes,
      push del 80%) y lo van a usar los reportes. Antes stats y Mi Mes
      contaban cualquier sesión, incluso abierta y vacía (Luz, 20/10:
      octubre daba 8 días / 62% en vez de 7 / 54%). Mismo criterio para
      las rachas (`computeStreaks`, ahora en `lib/utils/streaks.ts`,
      compartido por `stats.ts` y `coach-stats.ts` — antes duplicado), la
      "semana completa" de la celebración semanal (`checkWeeklyCompletion`
      y `cleanupWeeklyCelebrationIfIncomplete`) y Mi Entrenamiento del
      coach (`coach-stats.ts`, que además pasó a `plannedDaysInRange`).
    - Plan de los reportes de progreso: `docs/plan-reportes.md` (plan,
      SQL, banco de frases y cambios aprobados).
    - Tests unitarios: `npm test` (runner nativo de Node 24, que ejecuta
      TypeScript directo; `scripts/test-alias.mjs` resuelve el alias `@/`).
      Archivos `lib/**/*.test.ts`.

70. Reportes de progreso tipo Wrapped (oct-2026) — plan, SQL, banco de
    frases y reglas aprobadas en `docs/plan-reportes.md`. Migración
    `20261022_progress_reports.sql` (ya corrida): `progress_reports` (lo
    que ve el cliente: `cards` jsonb + `phrase_keys` + `coach_note`; el
    cliente solo lee `status = 'sent'`) y `progress_report_private`
    (avisos "Solo lo ves vos", solo coach — tabla aparte porque RLS filtra
    filas, no columnas), más `profiles.report_sunday_hour` y
    `clients.hide_weight_in_reports`.
    - Flujo: el cron crea BORRADORES (sábado desde 7:00 PYT: lunes a
      viernes; día 1 desde 7:00: mes anterior; con días de respaldo) y
      envía solo lo que el coach PROGRAMÓ. Nada sale sin el coach. Bandeja
      `/coach/reports` (+ aviso en el dashboard): vista previa en marco de
      teléfono, nota personal (va como tarjeta antes de la imagen para
      compartir), Enviar ahora / Programar para el domingo a su hora /
      Volver a generar / Descartar, aviso "Falta tu mensaje de cierre de
      mes". Al enviar: push "Tu semana está lista 🔥" / "Tu {mes} está
      listo" → `/client/home?report=<id>` (se abre solo); acceso destacado
      arriba en Inicio hasta verlo completo; historial en
      `/client/progress/reports`. `sendReport` es un UPDATE condicional:
      la push sale una sola vez aunque cron y coach envíen a la vez.
    - "Generar ahora" (arriba de la bandeja, `generate-now.tsx` +
      `generateReportNow`): un borrador del último período cerrado
      (`latestClosedPeriod`) para el cliente elegido, con el mismo
      `createDraft` del cron. Nunca envía ni manda push. Reglas en
      `lib/reports/generate-now.ts`: enviado → no se toca; borrador,
      programado o descartado → pregunta antes de regenerar.
    - Lógica pura y testeada en `lib/reports/` (`build-weekly`,
      `build-monthly`, `records`, `weight`, `weight-goal`, `phrases`,
      `schedule`; fixture anonimizado en `__fixtures__/`); lectura de datos
      en `load-input.ts` y escritura en `service.ts` (service role);
      lecturas con sesión en `lib/supabase/progress-reports.ts`.
      Reproductor compartido cliente/coach en `components/reports/` (portal
      a body en pantalla completa).
    - Reglas: récords contra la mejor marca HISTÓRICA anterior al período;
      día entrenado = finalizada con 1+ serie; volumen solo si sube (si no,
      aviso privado); líneas del objetivo sin dato → aviso privado; peso
      festejado solo en la dirección del objetivo (`weightDirectionFromGoal`:
      "perder grasa, ganar fuerza" es de bajar) y oculto con el interruptor
      de la ficha; cambio semanal < 0,5 kg → titular = tendencia; ninguna
      frase repetida en el reporte ni en los enviados de los últimos 28
      días, ni el mismo remate prioritario dos veces en un reporte.
    - Mi Mes borrado (`/client/my-month` redirige al historial); el
      objetivo del mes en curso quedó como tarjeta arriba de Progreso. La
      push "Terminaste el mes" se sacó de `daily-checks` (hay que
      redeployar la Edge Function a mano).
    - Cron: `POST /api/cron/progress-reports` con
      `Authorization: Bearer <CRON_SECRET>` (variable `CRON_SECRET` en
      Vercel), agendado con pg_cron + pg_net desde
      `20261022b_progress_reports_cron.sql` (secreto en Vault).

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
CRON_SECRET=
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
- Toda tabla nueva en `public` lleva sus `GRANT` en la MISMA migración: desde
  el 30-oct-2026 Supabase ya no le da permisos de la Data API a las tablas
  nuevas automáticamente (sin el grant, la app no la puede leer ni escribir
  aunque las policies RLS estén bien). Patrón: `grant select, insert,
  update, delete on public.<tabla> to authenticated;` y lo mismo `to
  service_role;` — nunca a `anon` salvo que la tabla sea pública a
  propósito.
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
- SMTP propio (Resend, dominio euskaditeam.app verificado oct-2026): el
  código ya está listo (ítem 62); falta confirmar en el Dashboard de
  Supabase el Custom SMTP, las plantillas de email con `token_hash` y
  activar "Confirm email".

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
