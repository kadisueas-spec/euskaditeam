-- Diagnósticos de los tipos de registro (oct-2026). Correr DESPUÉS de
-- supabase/migrations/20261028_tracking_types.sql (usan tracking_type y
-- per_side). Son de solo lectura, salvo los UPDATE del final, que están
-- comentados: se corren recién cuando decidamos qué convertir.
--
-- El SQL Editor muestra solo el resultado de la última consulta: correr
-- UNA POR VEZ (seleccionar el bloque y "Run selected").


-- =====================================================================
-- A) Series viejas de peso corporal, isométricos y cardio: qué quedó en
--    weight_kg (valores distintos y cuántas series tiene cada uno, por
--    ejercicio), y el rango de reps — para saber si en reps anotaron
--    segundos o minutos.
-- =====================================================================
select e.name                                     as ejercicio,
       e.tracking_type                            as tipo,
       e.per_side                                 as por_lado,
       s.weight_kg,
       count(*)                                   as series,
       min(s.reps_completed)                      as reps_min,
       max(s.reps_completed)                      as reps_max,
       count(*) filter (where s.rir_actual is not null) as con_rir,
       count(distinct wl.client_id)               as clientes,
       min(wl.workout_date)                       as desde,
       max(wl.workout_date)                       as hasta
from public.workout_set_logs s
join public.workout_logs wl      on wl.id = s.workout_log_id
join public.routine_exercises re on re.id = s.routine_exercise_id
join public.exercises e          on e.id = re.exercise_id
where e.tracking_type in ('bodyweight_reps', 'time', 'cardio')
group by e.name, e.tracking_type, e.per_side, s.weight_kg
order by e.tracking_type, e.name, s.weight_kg nulls first;


-- =====================================================================
-- B) Rutinas ya armadas con isométricos o cardio prescriptos en
--    reps_min/reps_max: qué filas cambiaría el UPDATE de abajo (incluye
--    plantillas, rutinas activas, archivadas y Mi Entrenamiento del coach).
-- =====================================================================
select case
         when r.is_template then 'plantilla'
         when r.client_id is null then 'mi entrenamiento'
         when r.is_active then 'activa'
         else 'archivada'
       end                                         as estado,
       coalesce(p.full_name, '—')                  as cliente,
       r.name                                      as rutina,
       rd.day_number                               as dia_n,
       rd.name                                     as dia,
       e.name                                      as ejercicio,
       e.tracking_type                             as tipo,
       re.sets, re.reps_min, re.reps_max, re.rir_target, re.rest_seconds,
       case when e.tracking_type = 'time' then re.reps_min end   as nuevo_seconds_min,
       case when e.tracking_type = 'time' then re.reps_max end   as nuevo_seconds_max,
       case when e.tracking_type = 'cardio'
            then coalesce(re.reps_max, re.reps_min) end          as nuevo_minutes_target
from public.routine_exercises re
join public.exercises e     on e.id = re.exercise_id
join public.routine_days rd on rd.id = re.day_id
join public.routines r      on r.id = rd.routine_id
left join public.clients c  on c.id = r.client_id
left join public.profiles p on p.id = c.user_id
where e.tracking_type in ('time', 'cardio')
  and (re.reps_min is not null or re.reps_max is not null)
  and re.seconds_min is null and re.seconds_max is null and re.minutes_target is null
order by estado, cliente, rutina, rd.day_number, re.order_index;


-- =====================================================================
-- C) Volumen por cliente y mes: el actual (peso × reps de todas las
--    series, igual que los reportes hoy) contra el nuevo:
--    - peso + reps: peso × reps, × 2 si es por lado;
--    - peso corporal: kilos guardados × reps (× 2 si es por lado) — igual
--      que hoy salvo por lado; qué son esos kilos se decide con la A;
--    - isométricos y cardio: no suman kilos.
--    Sesiones finalizadas, desde agosto. cambia_mas_5 = la diferencia
--    pasa del 5 %. clientes_mas_5_mes = cuántos clientes pasan del 5 % en
--    ese mes.
-- =====================================================================
with sets as (
  select wl.client_id,
         date_trunc('month', wl.workout_date)::date as mes,
         e.tracking_type, e.per_side,
         coalesce(s.weight_kg * s.reps_completed, 0) as kg
  from public.workout_set_logs s
  join public.workout_logs wl      on wl.id = s.workout_log_id
  left join public.routine_exercises re on re.id = s.routine_exercise_id
  left join public.exercises e     on e.id = re.exercise_id
  where wl.is_completed
    and wl.client_id is not null
    and wl.workout_date >= '2026-08-01'
),
by_month as (
  select client_id, mes,
         round(sum(kg))                                                       as actual,
         round(sum(case
                     when coalesce(tracking_type, 'weight_reps') in ('weight_reps', 'bodyweight_reps')
                       then kg * case when per_side then 2 else 1 end
                     else 0
                   end))                                                     as nuevo,
         round(sum(case when per_side and coalesce(tracking_type, 'weight_reps') in ('weight_reps', 'bodyweight_reps')
                        then kg else 0 end))                                 as suma_por_lado,
         round(sum(case when tracking_type in ('time', 'cardio') then kg else 0 end)) as resta_tiempo_cardio
  from sets
  group by client_id, mes
)
select coalesce(p.full_name, b.client_id::text)                              as cliente,
       to_char(b.mes, 'YYYY-MM')                                             as mes,
       b.actual, b.nuevo,
       b.suma_por_lado, b.resta_tiempo_cardio,
       case when b.actual > 0 then round((b.nuevo - b.actual) * 100.0 / b.actual, 1) end as diferencia_pct,
       (b.actual > 0 and abs(b.nuevo - b.actual) * 100.0 / b.actual > 5)     as cambia_mas_5,
       count(*) filter (where b.actual > 0 and abs(b.nuevo - b.actual) * 100.0 / b.actual > 5)
         over (partition by b.mes)                                           as clientes_mas_5_mes
from by_month b
left join public.clients c  on c.id = b.client_id
left join public.profiles p on p.id = c.user_id
order by cliente, mes;


-- =====================================================================
-- UPDATE de rutinas ya armadas (NO correr todavía: primero revisamos la
-- B). Copia la prescripción; no borra reps_min/reps_max. Solo toca filas
-- que todavía no tienen la prescripción nueva, así que se puede repetir.
-- =====================================================================
-- update public.routine_exercises re
-- set seconds_min = re.reps_min,
--     seconds_max = re.reps_max
-- from public.exercises e
-- where e.id = re.exercise_id
--   and e.tracking_type = 'time'
--   and (re.reps_min is not null or re.reps_max is not null)
--   and re.seconds_min is null and re.seconds_max is null;
--
-- update public.routine_exercises re
-- set minutes_target = coalesce(re.reps_max, re.reps_min)
-- from public.exercises e
-- where e.id = re.exercise_id
--   and e.tracking_type = 'cardio'
--   and (re.reps_min is not null or re.reps_max is not null)
--   and re.minutes_target is null;
