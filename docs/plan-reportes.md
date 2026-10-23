# Reportes de progreso — plan, SQL y banco de frases

## 1. PLAN

### Cómo se genera y se manda (decisión técnica)
- **Programación: `pg_cron` de Supabase llamando a una ruta de la app cada hora** (`/api/cron/progress-reports`, protegida con un secreto).
  - No Edge Function: la lógica vive en el código de la app y se deploya sola con cada push. Vos solo corrés UNA vez el SQL que agenda el llamado.
  - No Vercel Cron: en el plan Hobby solo corre una vez por día y con hasta 1 hora de desfase, así que no permite "domingo a la hora que yo elija".
  - Cada hora la ruta hace 3 cosas, todas idempotentes (si corre dos veces no duplica nada):
    1. Sábado desde las 11:00 (Paraguay): genera los borradores semanales que falten (lunes a viernes de esa semana).
    2. Día 1 desde las 7:00: genera los borradores mensuales del mes anterior.
    3. Siempre: envía los reportes programados cuya hora ya llegó.
- **Quién recibe reporte:** clientes con acceso activo y rutina activa. Si no entrenó nada, el borrador igual se genera (honesto y alentador) y vos decidís si mandarlo o descartarlo.

### Bandeja del coach — `/coach/reports` ("Reportes para revisar")
- Badge en el menú con la cantidad de borradores pendientes.
- Lista por cliente: tipo (semanal/mensual), período, estado (Borrador / Programado / Enviado).
- Al abrir uno: **vista previa idéntica a la del cliente** (mismo componente, en un marco de teléfono), y al lado el editor de cada tarjeta:
  - editar título y texto, prender/apagar la tarjeta, reordenar,
  - "Agregar nota personal" (tarjeta propia, va antes del cierre),
  - "Volver a generar con los datos de hoy" (con confirmación: pisa las ediciones),
  - **Enviar ahora** o **Programar para el domingo** (a tu hora configurada; se puede cambiar en la misma pantalla), o **Descartar**.
- Configuración: hora del envío del domingo (default 10:00).

### Entrega al cliente
- Push al enviar (banco de textos más abajo) que abre `/client/home?report=<id>`.
- En Inicio, si hay un reporte enviado sin terminar de ver: se abre solo a pantalla completa. Si lo cierra antes del final, queda una tarjeta destacada arriba de todo en Inicio ("Tu reporte de la semana te espera") hasta verlo completo.
- Historial en Progreso: `/client/progress/reports` (reemplaza el botón Mi Mes). Lista de todos los reportes; tocar uno lo reproduce.
- Orden: si hay varios sin ver, primero el más reciente.

### Reproductor tipo Wrapped (`components/reports/report-player.tsx`)
- Portal a `body` por encima de todo (mismo arreglo que el recorrido), pantalla completa, respeta notch y barra de gestos.
- Barras de progreso arriba como historias. Tocar derecha / deslizar izquierda = siguiente; tocar izquierda / deslizar derecha = anterior; deslizar abajo = cerrar. Sin avance automático por tiempo (que lo lea a su ritmo); si lo querés, se agrega.
- Cada tarjeta: un tema visual propio (fondo, color de acento, animación de entrada) de un set fijo de 6 temas en la estética Euskadi (negro, rojo, blanco; sin gradientes violeta-azul). Bebas Neue para el número grande, DM Sans para el texto. CSS puro con `prefers-reduced-motion`.
- Botón discreto "Ver en …" en cada tarjeta con dato, que cierra el reporte y lleva a la sección: ejercicio → su evolución en Progreso (agrego `?exercise=` a Estadísticas), cuerpo → Mi Cuerpo, peso → Mi Cuerpo/Peso, foto → Mi Cuerpo/Fotos con la subida abierta, nutrición → Mi Cuerpo/Nutrición.
- Se registra "abrió" y "lo vio completo" (al llegar a la última tarjeta).

### Tarjetas
**Semanal (4 a 6):**
1. Apertura — nombre + frase según cómo fue la semana.
2. La mejora más importante (récord con la prioridad que ya usamos: más kilos > más reps > más RIR). Si no hubo récord: tarjeta de esfuerzo (series/volumen de la semana).
3. Adherencia lunes a viernes — "4 de 4", barra por día (L M M J V).
4. Cuerpo — solo si hubo peso o evaluación nueva en la semana.
5. Lo que viene — foco de la semana siguiente.
6. Nota personal tuya — solo si la agregás.

**Mensual (8 a 12):** apertura · entrenamientos y adherencia del mes · rachas · récords del mes · dónde más progresaste (mini gráfico) · volumen vs mes anterior · composición corporal (si hubo evaluación) · peso del mes (gráfico) · fotos (si hace mucho que no sube, invita a subir) · nutrición (plan vigente) · objetivo del mes vs realidad · tu mensaje del cierre de mes · **última: la imagen compartible 1080×1920 con el botón Compartir**.
- Se arma reutilizando `getMyMonthSummary()` y sus bloques, pero hay que separarlo en una función que reciba cliente y mes (hoy solo funciona con la sesión del cliente y el último día del mes).

### Las tarjetas son una "foto" del momento
Al generarse se guardan con su texto y sus datos (JSON). Lo que vos edites es exactamente lo que ve el cliente; no se recalcula al enviar.

### Qué se elimina / cambia
- Se va: `/client/my-month`, el botón Mi Mes en Progreso, el candado y el desbloqueo de fin de mes. `/client/my-month` redirige a `/client/progress/reports`.
- Se queda: el modal de objetivo mensual (lo usa la tarjeta objetivo vs realidad) y la celebración de semana completa.
- **Edge Function `daily-checks`:** hoy manda la push "se desbloqueó tu mes" el último día. Hay que sacarla y la redeployás vos a mano (te paso el cambio exacto). Si no, la push lleva a una pantalla que ya no existe (redirige al historial, no rompe, pero confunde).

### Decisiones (aprobadas)
1. **Adherencia lunes a viernes si la rutina tiene 6 días:** se mide contra `mínimo(días de la rutina, 5)` — un cliente de 6 días que entrenó los 5 hábiles queda en 5/5, no en 5/6.
2. **Sin avance automático** de tarjetas (cada una se pasa a mano).
3. **Cierre de mes:** el reporte mensual se genera el día 1 con tu mensaje del cierre si ya lo escribiste. Si todavía no lo escribiste, la bandeja avisa "Falta tu mensaje de cierre de mes" (con link al cierre de ese cliente) y después usás "Volver a generar".

## 2. SQL (migración `20261021_progress_reports.sql`)

```sql
-- Reportes de progreso (oct-2026). Cada reporte guarda sus tarjetas ya
-- armadas (jsonb): lo que el coach edita es exactamente lo que ve el
-- cliente. Una sola fila por cliente/tipo/período (idempotente).
create table if not exists public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sent', 'discarded')),
  cards jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  scheduled_for timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (client_id, kind, period_start),
  constraint progress_reports_scheduled_has_time
    check (status <> 'scheduled' or scheduled_for is not null)
);

create index if not exists progress_reports_coach_status_idx
  on public.progress_reports (coach_id, status);
create index if not exists progress_reports_client_sent_idx
  on public.progress_reports (client_id, sent_at desc) where status = 'sent';
create index if not exists progress_reports_due_idx
  on public.progress_reports (scheduled_for) where status = 'scheduled';

-- Desde el 30-oct-2026 las tablas nuevas de public no reciben permisos de
-- la Data API solos: los GRANT van en la misma migración. Sin anon.
grant select, insert, update, delete on public.progress_reports to authenticated;
grant select, insert, update, delete on public.progress_reports to service_role;

alter table public.progress_reports enable row level security;

-- El coach gestiona los reportes de SUS clientes.
create policy "Coach manages own clients reports" on public.progress_reports
  for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and client_id in (select id from public.clients where coach_id = auth.uid())
  );

-- El cliente solo ve sus reportes ENVIADOS (nunca borradores). Marcar
-- "abierto/visto" va por una acción de servidor con service role (el
-- cliente no tiene UPDATE, mismo patrón que el banner y el recorrido).
create policy "Client views own sent reports" on public.progress_reports
  for select
  using (
    status = 'sent'
    and client_id in (select id from public.clients where user_id = auth.uid())
  );

-- Hora del envío programado del domingo (hora de Paraguay).
alter table public.profiles
  add column if not exists report_sunday_hour smallint not null default 10
  check (report_sunday_hour between 0 and 23);

notify pgrst, 'reload schema';
```

**Agenda (se corre aparte, cuando el código ya esté deployado):**
```sql
create extension if not exists pg_net;
select cron.schedule(
  'progress-reports-hourly',
  '5 * * * *',  -- minuto 5 de cada hora
  $$ select net.http_post(
       url := 'https://euskaditeam.app/api/cron/progress-reports',
       headers := jsonb_build_object(
         'Authorization', 'Bearer <CRON_SECRET>',
         'Content-Type', 'application/json'),
       body := '{}'::jsonb) $$
);
```
Más la variable `CRON_SECRET` en Vercel (un texto largo al azar, el mismo que va en el SQL).

## 3. BANCO DE FRASES

Variables entre llaves se completan con datos reales. Si un dato no existe, esa frase no se usa (nunca se inventa). Emojis solo 👏🏻 y 🫡, y no en todas.

**Frases prioritarias:** "Cumpliste con lo que pudiste y eso es lo que importa" y "Todo el esfuerzo vale la pena" (y sus variantes) van primero en su situación y salen el doble de seguido que las otras variantes.

### Apertura semanal (según cómo fue la semana)
**Semana completa con progreso**
1. {nombre}, qué semana! Excelente el trabajo, orgulloso del progreso que estás teniendo 👏🏻👏🏻
2. {nombre}, cumpliste todo y encima mejoraste. Así se construye 👏🏻
3. Semana completa y con avances, {nombre}. Esto es lo que buscamos
4. {nombre}, no fallaste ni un día y se nota en los números. Orgulloso 👏🏻

**Semana completa sin récords**
1. {nombre}, cumpliste con todo esta semana. El progreso es más que números, entrenaste intenso y eso es lo que te va a hacer mejorar
2. Semana completa, {nombre}. No siempre se ve en los números, pero el trabajo está hecho 🫡
3. {nombre}, estuviste todos los días. La constancia es la que después trae los resultados

**Entrenó menos de lo planificado**
1. {nombre}, cumpliste con lo que pudiste y eso es lo que importa. La próxima semana damos todo de vuelta
2. {dias_hechos} de {dias_plan} esta semana, {nombre}. Lo que hiciste suma, y la que viene vamos por todo 🫡
3. {nombre}, hubo semanas más fáciles, pero estuviste. La próxima la encaramos con todo
4. No fue la semana completa, {nombre}, pero cada entrenamiento cuenta. Seguimos

**Volvió después de faltar**
1. {nombre}, me alegra que hayas retomado, hay que seguir esforzándonos todo lo que podamos 🫡
2. Qué bueno verte de vuelta, {nombre}. Lo más difícil era volver y ya lo hiciste
3. {nombre}, retomaste y eso es lo que importa. Ahora a sostenerlo juntos
4. Volviste, {nombre}! Arrancamos de nuevo y vamos de a poco pero firmes 🫡

**No entrenó en la semana**
1. {nombre}, esta semana no se pudo entrenar, pasa. La que viene arrancamos de nuevo juntos
2. Semana sin entrenamientos, {nombre}. No pasa nada, lo importante es volver. Te espero en el próximo entrenamiento 🫡
3. {nombre}, a veces la semana no da. Lo que importa es la próxima, y ahí vamos con todo
(Esta semana sugiere mandarla con nota personal o descartarla; la bandeja lo avisa.)

### Mejora más importante (récord)
**Más kilos**
1. Le subiste {delta_kg} kg a {ejercicio}. Ahora movés {kg} kg × {reps} 👏🏻
2. {ejercicio}: de {kg_antes} a {kg} kg. Todo el esfuerzo vale la pena
3. +{delta_kg} kg en {ejercicio}. Así se progresa, semana a semana
4. {kg} kg en {ejercicio}, {delta_kg} kg más que tu mejor marca. Vamos por más

**Más repeticiones con el mismo peso**
1. Con {kg} kg en {ejercicio} hiciste {delta_reps} reps más. Eso es fuerza nueva
2. {ejercicio}: {reps} reps con {kg} kg, {delta_reps} más que tu mejor marca 👏🏻 (aprobada)
3. Mismo peso en {ejercicio}, más reps. El próximo paso es subir el kilaje

**Mismo peso y reps con más RIR (le sobró más)**
1. {ejercicio} te salió más fácil: mismo peso y reps, pero te sobraron {delta_rir} reps más. Te estás haciendo más fuerte
2. En {ejercicio} pasaste de RIR {rir_antes} a RIR {rir}. Te está costando menos, eso es que te estás haciendo más fuerte 🫡
3. {ejercicio} con más resto que tu mejor marca. Todo el esfuerzo vale la pena 👏🏻

**Sin récord esta semana (tarjeta de esfuerzo)**
1. Esta semana fueron {series} series y {volumen} kg movidos. El progreso es más que números, lo diste todo
2. {series} series hechas. Cumpliste con lo que pudiste y eso es lo que importa
3. Sin récords esta semana, pero con {series} series encima. Eso después se nota

### Adherencia lunes a viernes
- **Completa:** "{dias_hechos} de {dias_plan}. Semana completa 👏🏻" / "No faltaste ni un día" / "{dias_hechos} de {dias_plan}: así se hace"
- **Parcial:** "{dias_hechos} de {dias_plan} esta semana. Cada día cuenta" / "Hiciste {dias_hechos} de {dias_plan}. La que viene vamos por los {dias_plan}"
- **Cero:** "Esta semana no hubo entrenamientos. El lunes arrancamos de nuevo"

### Cuerpo
**Bajó de peso / cambio visible** (solo si el objetivo es bajar o no hay objetivo de subir)
1. {delta_peso} kg menos esta semana. Todo el esfuerzo vale la pena! Y vamos por más
2. Bajaste {delta_peso} kg. Se está notando el trabajo 👏🏻
3. {peso} kg hoy, {delta_peso} menos que la semana pasada. Seguimos así

**Subió de peso con objetivo de ganar masa**
1. +{delta_peso} kg esta semana, justo lo que buscamos para ganar masa
2. Subiste {delta_peso} kg. El plan está funcionando, a seguir comiendo y entrenando

**Peso estable / sin cambios**
1. Peso estable esta semana. Las semanas firmes también son parte del proceso
2. Sin cambios en la balanza esta semana. Importa la tendencia de varias semanas, no un día
3. Te mantuviste en {peso} kg. Seguimos sumando

**Evaluación nueva**
1. Evaluación nueva: {grasa}% de grasa{cambio_grasa}. Mirá el detalle en Mi Cuerpo
2. Tu nueva medición ya está: {grasa}% de grasa y {musculo} kg de músculo
3. Te medí: {grasa}% de grasa{cambio_grasa}. Todo el esfuerzo vale la pena

**No cargó peso** (no se arma tarjeta de cuerpo; si pasaron 10+ días sin pesarse, va como foco)

### Lo que viene (foco de la semana siguiente)
1. **Completar días:** "La próxima semana vamos por los {dias_plan} días. Organizate desde el lunes 🫡"
2. **Seguir subiendo un ejercicio:** "En {ejercicio} estás para subir de nuevo. Esa es la próxima meta"
3. **Sostener:** "Mantener lo que venimos haciendo. Así, semana a semana"
4. **Fin de mesociclo cerca:** "Esta es la última semana del mesociclo. Cerramos fuerte"
5. **Pesarse:** "Acordate de registrar tu peso esta semana, así vemos cómo venís"
6. **Foto:** "Hace {dias_sin_foto} días que no subís una foto. Sacate una esta semana así comparamos"

### Mensual
**Apertura**
1. {nombre}, este fue tu {mes}. Vamos a repasarlo juntos
2. {mes} terminado, {nombre}. Mirá todo lo que hiciste
3. {nombre}, así fue tu {mes} en Euskadi Team

### Período libre ("TU PROGRESO", oct-2026)
**Apertura** (según si hubo avance: 1+ mejores marcas contra la mejor marca anterior al inicio del rango, volumen que subió contra el período anterior de igual duración, o peso 0,5 kg o más hacia el objetivo — el peso no cuenta si está activo "No mostrar peso en reportes")
- Con avance (`custom.opening.progress.1-3`):
  1. {nombre}, mirá todo lo que avanzaste. Vamos a repasarlo juntos
  2. {nombre}, hay avances para festejar. Vamos a repasarlos juntos
  3. {nombre}, el esfuerzo se nota. Mirá lo que lograste
- Sin avance (`custom.opening.steady.1-3`):
  1. {nombre}, la constancia es lo que cuenta. Vamos a repasarlo juntos
  2. {nombre}, seguir presente ya es ganar. Vamos a repasarlo juntos
  3. {nombre}, lo importante es no soltar. Mirá cómo viene tu camino
- Mismo criterio que el resto del banco: no se repite una frase enviada al cliente en los últimos 28 días.

**Adherencia del mes**
- Alta (80%+): "{entrenamientos} entrenamientos en {mes}. Orgulloso de tu constancia 👏🏻👏🏻" / "{adherencia}% de lo planificado. Así se hace"
- Media (50-79%): "Cumpliste con lo que pudiste, el mes que viene damos todo de vuelta" (el número ya está grande arriba)
- Baja (<50%): "Fue un mes difícil, {entrenamientos} entrenamientos. Lo importante es seguir, y en {mes_siguiente} vamos con todo 🫡"

**Récords del mes**
- Muchos (4+): "{records} récords en un mes. Todo el esfuerzo vale la pena! 👏🏻"
- Algunos (1-3): "{records} récord{s} este mes. Cada uno es un paso adelante"
- Ninguno: "Este mes fue de consolidar. El progreso es más que números"

**Contra el mes anterior**
- Mejor: "{volumen_pct}% más volumen que en {mes_anterior}. Vamos por más"
- Parecido: "Un mes parejo con {mes_anterior}. Sostener también es avanzar"
- Menor: "Menos volumen que {mes_anterior}, y está bien: hay meses así. Seguimos" (nunca en tono de reproche)

**Objetivo del mes vs realidad**
- Cumplido: "Te propusiste {objetivo}. Lo cumpliste 👏🏻"
- Cerca: "Te propusiste {objetivo}. Te quedaste muy cerca, el mes que viene lo cerramos"
- No llegó: "Te propusiste {objetivo}. No se dio esta vez, pero lo que entrenaste suma. Vamos de nuevo 🫡"
- En camino (objetivo con varias partes, avance en algunas y sin dato en otras): "Vamos por buen camino con lo que te propusiste. Seguimos 🫡" (aprobada)

**Fotos / nutrición (invitación)**
- Sin foto hace 30+ días: "Hace {dias_sin_foto} días que no subís una foto. Sacate una y la comparamos con la anterior"
- Plan de nutrición vigente: "Seguí con tu plan {plan}, que está armado para lo que buscás"

**Cierre (antes de la imagen para compartir)**
1. Otro mes más que sumamos, {nombre}. Orgulloso de lo que hiciste 👏🏻
2. Así cerramos {mes}. Orgulloso de lo que hiciste, a seguir
3. Un mes más sumado. Vamos juntos por el próximo

### Textos de la push
**Semanal**
1. Tu semana en Euskadi Team ya está lista 👏🏻
2. {nombre}, te armé el resumen de tu semana. Entrá a verlo
3. Mirá cómo te fue esta semana

**Mensual**
1. {nombre}, tu {mes} ya está listo. Entrá a ver todo lo que hiciste
2. Así fue tu {mes}. Te preparé el resumen 🫡
3. Tu resumen de {mes} te espera

## 4. BORRADOR CON DATOS REALES

No tengo acceso a la base, así que necesito que corras una consulta de SOLO LECTURA (no escribe nada) con el email de un cliente activo: `export-reporte.sql`. Me pegás el JSON que devuelve y con eso armo el borrador semanal (lunes a viernes de la semana pasada) y el mensual (septiembre), los renderizo en el formato real a 390×844 y te muestro las capturas tarjeta por tarjeta. Nada se guarda ni se envía.

## 5. CAMBIOS APROBADOS (22-oct-2026, revisión de hojas)

Reglas de armado:
- Apertura semanal según asistencia Y récords: 3+ mejores marcas → "Excelente el trabajo de esta semana! Orgulloso del progreso que estás teniendo👏🏻👏🏻" (aunque la asistencia no sea perfecta). "Cumpliste con lo que pudiste…" solo para semanas flojas sin récords destacados.
- Récords: siempre contra la mejor marca histórica anterior al período. Lista con peso × reps y diferencia en rojo (+5 KG, +2 REPS, "RIR 3 (antes 1)"), nunca nombres sueltos.
- Volumen vs mes anterior: tarjeta solo si SUBE. Si baja → aviso privado ("Volumen −25 % vs agosto: 12 entrenamientos contra 17").
- Objetivo: las líneas sin dato no se muestran al cliente → aviso privado ("Grasa: sin medición este mes").
- Peso: si el cambio semanal es < 0,5 kg, el titular es la tendencia desde el inicio (promedio de la primera semana con datos vs el de esta semana). El texto nunca contradice el gráfico. Se festeja bajar solo si el objetivo incluye perder grasa/peso; subir solo si es ganar masa; sin objetivo de peso → dato + tendencia, sin festejo. Interruptor por cliente "No mostrar peso en reportes" oculta la tarjeta de peso y la línea de peso del objetivo.
- Cierre firmado solo con el nombre del coach y "Tu coach" debajo: sin foto ni círculo con la inicial (cambio oct-2026).
- Portadas rojas: textos del encabezado en negro.
- Frases sin repetir: ni dentro de un reporte ni una que el cliente recibió en reportes ENVIADOS de las últimas 4 semanas. Cada tarjeta guarda en cards jsonb su `phrase_key` (situación + número de variante, ej. "weight.down.3"); al generar se excluyen las keys usadas en progress_reports del cliente con sent_at en los últimos 28 días. Si una situación se queda sin variantes libres, se usa la menos reciente.

Frases nuevas:
- Apertura semanal con 3+ récords: "Excelente el trabajo de esta semana! Orgulloso del progreso que estás teniendo👏🏻👏🏻" (aprobada, texto de Luis)
- Peso, tendencia (cambio semanal chico): "{peso_promedio_semana} kg esta semana, {delta_peso} menos que en {mes_inicio}. Seguimos así 👏🏻" (aprobada; es el promedio semanal, nunca "hoy")
