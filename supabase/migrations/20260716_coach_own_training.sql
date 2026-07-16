-- El coach entrena y quiere sus propias métricas (peso máx/promedio por
-- ejercicio, racha, adherencia) — mismo motor que ya usan los clientes.
--
-- routines/routine_days/routine_exercises NO necesitan ningún cambio: su
-- RLS ("Coach manages routines/routine days/routine exercises") ya solo
-- exige coach_id = auth.uid(), sin pedir client_id — así que una rutina
-- con client_id NULL y coach_id = el propio coach ya es 100% válida y
-- gestionable hoy mismo, sin tocar nada. client_id ya era nullable en el
-- schema real (aunque la app siempre lo llena al crear rutinas de cliente).
--
-- workout_logs sí necesita coach_id (nullable, exclusivo con client_id,
-- mismo patrón ya usado en push_subscriptions) para poder identificar de
-- qué coach es un entrenamiento propio cuando client_id es NULL.
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase.

alter table public.workout_logs
  add column coach_id uuid references public.profiles(id) on delete cascade;

alter table public.workout_logs
  add constraint workout_logs_owner_check check (
    (client_id is not null and coach_id is null)
    or (client_id is null and coach_id is not null)
  );

create policy "Coach manages own training logs"
  on public.workout_logs
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Coach manages own training set logs"
  on public.workout_set_logs
  using (workout_log_id in (
    select wl.id from public.workout_logs wl where wl.coach_id = auth.uid()
  ))
  with check (workout_log_id in (
    select wl.id from public.workout_logs wl where wl.coach_id = auth.uid()
  ));
