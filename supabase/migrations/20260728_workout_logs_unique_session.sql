-- Un solo workout_log por cliente+día+fecha (jul-2026). Correr a mano en
-- el SQL Editor del Dashboard de Supabase — este archivo documenta el SQL
-- real ejecutado.
--
-- Bug reportado por Luis: si un cliente finalizaba un entrenamiento por
-- error (con un ejercicio salteado) y volvía a entrar a ese mismo día, la
-- app no encontraba el log ya completado y creaba uno nuevo desde cero —
-- perdía todas las series ya cargadas. Ya se corrigió en el código
-- (getOrCreateInProgressWorkout ahora reusa/reabre el log existente en vez
-- de crear uno nuevo), pero esta restricción es la red de contención a
-- nivel de base de datos: aunque un bug futuro repita el mismo error, la
-- base rechaza el duplicado en vez de guardarlo silenciosamente.
--
-- Verificado antes de aplicar (jul-2026): 0 grupos (client_id,
-- routine_day_id, workout_date) con más de una fila sobre 42 workout_logs
-- reales con routine_day_id — no hace falta limpiar nada antes.
--
-- Sin filtro parcial (WHERE client_id IS NOT NULL): no hace falta — un
-- constraint UNIQUE normal ya no bloquea filas con NULL (cada NULL cuenta
-- como distinto), así que los workout_logs del propio coach
-- (coach_id en vez de client_id, client_id siempre NULL en esas filas) no
-- quedan afectados por esta restricción.

alter table public.workout_logs
  add constraint workout_logs_client_day_date_key
  unique (client_id, routine_day_id, workout_date);
