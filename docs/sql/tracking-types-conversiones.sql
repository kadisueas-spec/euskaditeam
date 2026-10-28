-- Conversiones de datos viejos para los tipos de registro (oct-2026),
-- decididas con el diagnóstico A. Correr DESPUÉS de
-- supabase/migrations/20261028_tracking_types.sql.
--
-- Cómo correrlo: un bloque por vez ("Run selected"), en orden. Cada paso
-- tiene primero un SELECT de vista previa (qué filas cambia y cuántas) y
-- después el UPDATE. El UPDATE guarda los valores viejos en el respaldo y
-- cambia EXACTAMENTE esas filas en una sola sentencia (atómico: o pasan
-- las dos cosas o ninguna). Correrlo dos veces no hace nada la segunda vez.
--
-- Respaldo: esquema "backup", que la Data API no expone (la app no lo ve,
-- solo el SQL Editor) — por eso no lleva GRANT. Para deshacer un paso, ver
-- el final del archivo.


-- =====================================================================
-- 0) Respaldo (una sola vez)
-- =====================================================================
create schema if not exists backup;

create table if not exists backup.set_logs_tracking_20261028 (
  step             text        not null,
  set_log_id       uuid        not null,
  weight_kg        numeric,
  reps_completed   integer,
  rir_actual       integer,
  duration_seconds integer,
  intensity        numeric,
  assistance       numeric,
  backed_up_at     timestamptz not null default now(),
  primary key (step, set_log_id)
);
-- Por si la tabla ya se había creado sin esta columna
alter table backup.set_logs_tracking_20261028 add column if not exists assistance numeric;

create table if not exists backup.routine_exercises_tracking_20261028 (
  routine_exercise_id uuid        primary key,
  exercise_id         uuid,
  backed_up_at        timestamptz not null default now()
);

create table if not exists backup.exercises_tracking_20261028 (
  exercise_id   uuid        primary key,
  name          text,
  tracking_type text,
  per_side      boolean,
  backed_up_at  timestamptz not null default now()
);


-- =====================================================================
-- 1) Peso del cliente cargado como peso: Dominadas (pull-ups) y Fondos en
--    paralelas (pecho y tríceps) con weight_kg >= 55 → null. Incluye la
--    de 77,5 kg × 13 del 24/10 (punto 6).
-- =====================================================================
-- 1a) Vista previa
select coalesce(p.full_name, '—') as cliente, wl.workout_date as fecha,
       e.name as ejercicio, s.set_number as serie,
       s.weight_kg, s.reps_completed, s.rir_actual,
       count(*) over () as total_filas
from public.workout_set_logs s
join public.workout_logs wl      on wl.id = s.workout_log_id
join public.routine_exercises re on re.id = s.routine_exercise_id
join public.exercises e          on e.id = re.exercise_id
left join public.clients c       on c.id = wl.client_id
left join public.profiles p      on p.id = c.user_id
where translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') in
        ('dominadas (pull-ups)', 'fondos en paralelas (para pecho)', 'fondos en paralelas (para triceps)')
  and s.weight_kg >= 55
order by cliente, fecha, ejercicio, serie;

-- 1b) Respaldo + UPDATE
with target as (
  select s.id
  from public.workout_set_logs s
  join public.routine_exercises re on re.id = s.routine_exercise_id
  join public.exercises e          on e.id = re.exercise_id
  where translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') in
          ('dominadas (pull-ups)', 'fondos en paralelas (para pecho)', 'fondos en paralelas (para triceps)')
    and s.weight_kg >= 55
),
bk as (
  insert into backup.set_logs_tracking_20261028
    (step, set_log_id, weight_kg, reps_completed, rir_actual, duration_seconds, intensity)
  select '1', s.id, s.weight_kg, s.reps_completed, s.rir_actual, s.duration_seconds, s.intensity
  from public.workout_set_logs s
  where s.id in (select id from target)
  on conflict do nothing
  returning set_log_id
)
update public.workout_set_logs s
set weight_kg = null
where s.id in (select set_log_id from bk)
returning s.id, s.set_number, s.reps_completed;


-- =====================================================================
-- 2) Relleno de 1 kg en peso corporal: weight_kg <= 1 → null en los
--    ejercicios de peso corporal. Quedan afuera solos (weight_kg > 1) los
--    2,5 kg del crunch y la serie de elevación de piernas de 8 kg × 0.
--    Excluye explícitamente la patada de glúteo en cuadrupedia (paso 3:
--    pasa a ser de peso) y los asistidos (ahí los kilos son de ayuda).
-- =====================================================================
-- 2a) Vista previa (resumen por ejercicio y valor; total abajo)
select e.name as ejercicio, s.weight_kg, count(*) as series,
       sum(count(*)) over () as total_filas
from public.workout_set_logs s
join public.routine_exercises re on re.id = s.routine_exercise_id
join public.exercises e          on e.id = re.exercise_id
where e.tracking_type = 'bodyweight_reps'
  and e.assistance_unit is null
  and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') <> 'patada de gluteo en cuadrupedia'
  and s.weight_kg <= 1
group by e.name, s.weight_kg
order by e.name, s.weight_kg;

-- 2b) Respaldo + UPDATE
with target as (
  select s.id
  from public.workout_set_logs s
  join public.routine_exercises re on re.id = s.routine_exercise_id
  join public.exercises e          on e.id = re.exercise_id
  where e.tracking_type = 'bodyweight_reps'
    and e.assistance_unit is null
    and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') <> 'patada de gluteo en cuadrupedia'
    and s.weight_kg <= 1
),
bk as (
  insert into backup.set_logs_tracking_20261028
    (step, set_log_id, weight_kg, reps_completed, rir_actual, duration_seconds, intensity)
  select '2', s.id, s.weight_kg, s.reps_completed, s.rir_actual, s.duration_seconds, s.intensity
  from public.workout_set_logs s
  where s.id in (select id from target)
  on conflict do nothing
  returning set_log_id
)
update public.workout_set_logs s
set weight_kg = null
where s.id in (select set_log_id from bk)
returning s.id;


-- =====================================================================
-- 3) Patada de glúteo en cuadrupedia → weight_reps, por lado. Solo el
--    catálogo: las series viejas no se tocan.
-- =====================================================================
-- 3a) Vista previa
select id, name, tracking_type, per_side,
       case when coach_id is null then 'global' else 'propio' end as origen,
       count(*) over () as total_filas
from public.exercises
where translate(lower(trim(name)), 'áéíóúü', 'aeiouu') = 'patada de gluteo en cuadrupedia';

-- 3b) Respaldo + UPDATE
with target as (
  select id from public.exercises
  where translate(lower(trim(name)), 'áéíóúü', 'aeiouu') = 'patada de gluteo en cuadrupedia'
),
bk as (
  insert into backup.exercises_tracking_20261028 (exercise_id, name, tracking_type, per_side)
  select e.id, e.name, e.tracking_type, e.per_side
  from public.exercises e
  where e.id in (select id from target)
  on conflict do nothing
  returning exercise_id
)
update public.exercises e
set tracking_type = 'weight_reps', per_side = true
where e.id in (select exercise_id from bk)
returning e.id, e.name, e.tracking_type, e.per_side;


-- =====================================================================
-- 4) Escaladora: las series de 5 kg × 15 (un cliente, 23 al 27/10) eran
--    15 minutos a nivel 5 → duration_seconds = 900, intensity = 5,
--    weight_kg y reps_completed = null.
-- =====================================================================
-- 4a) Vista previa (mirá que sea un solo cliente y esas fechas)
select coalesce(p.full_name, '—') as cliente, wl.workout_date as fecha,
       s.set_number as serie, s.weight_kg, s.reps_completed, s.rir_actual,
       count(*) over () as total_filas
from public.workout_set_logs s
join public.workout_logs wl      on wl.id = s.workout_log_id
join public.routine_exercises re on re.id = s.routine_exercise_id
join public.exercises e          on e.id = re.exercise_id
left join public.clients c       on c.id = wl.client_id
left join public.profiles p      on p.id = c.user_id
where translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') = 'escaladora'
  and s.weight_kg = 5 and s.reps_completed = 15
  and wl.workout_date between '2026-10-23' and '2026-10-27'
order by fecha, serie;

-- 4b) Respaldo + UPDATE
with target as (
  select s.id
  from public.workout_set_logs s
  join public.workout_logs wl      on wl.id = s.workout_log_id
  join public.routine_exercises re on re.id = s.routine_exercise_id
  join public.exercises e          on e.id = re.exercise_id
  where translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') = 'escaladora'
    and s.weight_kg = 5 and s.reps_completed = 15
    and wl.workout_date between '2026-10-23' and '2026-10-27'
),
bk as (
  insert into backup.set_logs_tracking_20261028
    (step, set_log_id, weight_kg, reps_completed, rir_actual, duration_seconds, intensity)
  select '4', s.id, s.weight_kg, s.reps_completed, s.rir_actual, s.duration_seconds, s.intensity
  from public.workout_set_logs s
  where s.id in (select id from target)
  on conflict do nothing
  returning set_log_id
)
update public.workout_set_logs s
set duration_seconds = 900, intensity = 5, weight_kg = null, reps_completed = null
where s.id in (select set_log_id from bk)
returning s.id, s.set_number, s.duration_seconds, s.intensity;


-- =====================================================================
-- 5) Solo diagnóstico (no cambia nada): dominadas con 15 a 30 kg. Muestra
--    TODAS las series de dominadas de los clientes que tienen alguna en
--    ese rango, para comparar con sus otras sesiones, y si el ejercicio de
--    la rutina es "Dominadas (pull-ups)".
-- =====================================================================
with sospechosos as (
  select distinct wl.client_id
  from public.workout_set_logs s
  join public.workout_logs wl      on wl.id = s.workout_log_id
  join public.routine_exercises re on re.id = s.routine_exercise_id
  join public.exercises e          on e.id = re.exercise_id
  where translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') like 'dominadas%'
    and s.weight_kg between 15 and 30
)
select coalesce(p.full_name, '—')                 as cliente,
       wl.workout_date                            as fecha,
       r.name                                     as rutina,
       rd.name                                    as dia,
       e.name                                     as ejercicio_en_la_rutina,
       (translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') = 'dominadas (pull-ups)') as es_pull_ups,
       re.reps_min, re.reps_max, re.coach_notes,
       s.set_number                               as serie,
       s.weight_kg, s.reps_completed, s.rir_actual,
       (s.weight_kg between 15 and 30)            as en_rango_15_30
from public.workout_set_logs s
join public.workout_logs wl      on wl.id = s.workout_log_id
join public.routine_exercises re on re.id = s.routine_exercise_id
join public.exercises e          on e.id = re.exercise_id
join public.routine_days rd      on rd.id = re.day_id
join public.routines r           on r.id = rd.routine_id
left join public.clients c       on c.id = wl.client_id
left join public.profiles p      on p.id = c.user_id
where wl.client_id in (select client_id from sospechosos)
  and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') like 'dominadas%'
order by cliente, fecha, serie;


-- =====================================================================
-- 6) Daniela Cristina Espinola Neves de Souza usa la máquina asistida: en
--    su rutina ACTIVA, "Dominadas (pull-ups)" pasa a "Dominadas asistidas"
--    (cambia exercise_id en routine_exercises; la fila es la misma, así
--    que sus series siguen unidas a la rutina y no se pierde historial).
--    El destino es "Dominadas asistidas" con asistencia en kg: si hubiera
--    más de una, el UPDATE falla en vez de elegir una al azar.
-- =====================================================================
-- 6a) Vista previa: la fila de la rutina que cambia (tiene que ser 1, o
--     una por día si la rutina tiene dominadas en más de un día) y el
--     ejercicio destino
select coalesce(p.full_name, '—')  as cliente,
       r.name                      as rutina,
       r.is_active                 as activa,
       rd.day_number               as dia_n,
       rd.name                     as dia,
       re.id                       as routine_exercise_id,
       e.name                      as ejercicio_actual,
       (select string_agg(d.name || ' · ' || d.id::text, ', ')
          from public.exercises d
          where translate(lower(trim(d.name)), 'áéíóúü', 'aeiouu') = 'dominadas asistidas'
            and d.assistance_unit = 'kg')   as ejercicio_destino,
       (select count(*) from public.workout_set_logs s where s.routine_exercise_id = re.id) as series_unidas,
       count(*) over ()            as total_filas
from public.routine_exercises re
join public.exercises e     on e.id = re.exercise_id
join public.routine_days rd on rd.id = re.day_id
join public.routines r      on r.id = rd.routine_id
join public.clients c       on c.id = r.client_id
join public.profiles p      on p.id = c.user_id
where p.full_name ilike 'Daniela Cristina Espinola%'
  and r.is_active and not r.is_template
  and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') = 'dominadas (pull-ups)'
order by rd.day_number, re.order_index;

-- 6b) Respaldo + UPDATE
with destino as (
  select (select d.id from public.exercises d
          where translate(lower(trim(d.name)), 'áéíóúü', 'aeiouu') = 'dominadas asistidas'
            and d.assistance_unit = 'kg') as id
),
target as (
  select re.id
  from public.routine_exercises re
  join public.exercises e     on e.id = re.exercise_id
  join public.routine_days rd on rd.id = re.day_id
  join public.routines r      on r.id = rd.routine_id
  join public.clients c       on c.id = r.client_id
  join public.profiles p      on p.id = c.user_id
  where p.full_name ilike 'Daniela Cristina Espinola%'
    and r.is_active and not r.is_template
    and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') = 'dominadas (pull-ups)'
    and (select id from destino) is not null
),
bk as (
  insert into backup.routine_exercises_tracking_20261028 (routine_exercise_id, exercise_id)
  select re.id, re.exercise_id
  from public.routine_exercises re
  where re.id in (select id from target)
  on conflict do nothing
  returning routine_exercise_id
)
update public.routine_exercises re
set exercise_id = (select id from destino)
where re.id in (select routine_exercise_id from bk)
returning re.id, re.exercise_id;


-- =====================================================================
-- 7) Sus series de ese ejercicio con weight_kg entre 15 y 30: el valor
--    pasa a assistance (kg de ayuda) y weight_kg queda en null. Solo
--    Daniela y solo su rutina ACTIVA: el ejercicio es "Dominadas (pull-ups)"
--    antes del paso 6 y "Dominadas asistidas" después, así que la vista
--    previa sirve en cualquier orden. Ningún otro cliente. Correr el
--    UPDATE después del paso 6.
-- =====================================================================
-- 7a) Vista previa
select coalesce(p.full_name, '—') as cliente, wl.workout_date as fecha,
       r.name as rutina, e.name as ejercicio, s.set_number as serie,
       s.weight_kg, s.reps_completed, s.rir_actual, s.assistance,
       count(*) over () as total_filas
from public.workout_set_logs s
join public.workout_logs wl      on wl.id = s.workout_log_id
join public.routine_exercises re on re.id = s.routine_exercise_id
join public.exercises e          on e.id = re.exercise_id
join public.routine_days rd      on rd.id = re.day_id
join public.routines r           on r.id = rd.routine_id
join public.clients c            on c.id = wl.client_id
join public.profiles p           on p.id = c.user_id
where p.full_name ilike 'Daniela Cristina Espinola%'
  and r.is_active and not r.is_template
  and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') in ('dominadas (pull-ups)', 'dominadas asistidas')
  and s.weight_kg between 15 and 30
order by fecha, serie;

-- 7b) Respaldo + UPDATE
with target as (
  select s.id
  from public.workout_set_logs s
  join public.workout_logs wl      on wl.id = s.workout_log_id
  join public.routine_exercises re on re.id = s.routine_exercise_id
  join public.exercises e          on e.id = re.exercise_id
  join public.routine_days rd      on rd.id = re.day_id
  join public.routines r           on r.id = rd.routine_id
  join public.clients c            on c.id = wl.client_id
  join public.profiles p           on p.id = c.user_id
  where p.full_name ilike 'Daniela Cristina Espinola%'
    and r.is_active and not r.is_template
    and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') in ('dominadas (pull-ups)', 'dominadas asistidas')
    and s.weight_kg between 15 and 30
),
bk as (
  insert into backup.set_logs_tracking_20261028
    (step, set_log_id, weight_kg, reps_completed, rir_actual, duration_seconds, intensity, assistance)
  select '7', s.id, s.weight_kg, s.reps_completed, s.rir_actual, s.duration_seconds, s.intensity, s.assistance
  from public.workout_set_logs s
  where s.id in (select id from target)
  on conflict do nothing
  returning set_log_id
)
update public.workout_set_logs s
set assistance = s.weight_kg, weight_kg = null
where s.id in (select set_log_id from bk)
returning s.id, s.set_number, s.assistance;

-- 7c) Control (no cambia nada): las OTRAS series de dominadas de Daniela
--     que el paso 7 no toca — fuera de 15–30 kg, o en otra rutina (por
--     ejemplo una archivada). Si sale alguna fila, avisame antes de hacer
--     nada con ellas.
select wl.workout_date as fecha, r.name as rutina, r.is_active as activa,
       e.name as ejercicio, s.set_number as serie,
       s.weight_kg, s.reps_completed, s.rir_actual, s.assistance
from public.workout_set_logs s
join public.workout_logs wl      on wl.id = s.workout_log_id
join public.routine_exercises re on re.id = s.routine_exercise_id
join public.exercises e          on e.id = re.exercise_id
join public.routine_days rd      on rd.id = re.day_id
join public.routines r           on r.id = rd.routine_id
join public.clients c            on c.id = wl.client_id
join public.profiles p           on p.id = c.user_id
where p.full_name ilike 'Daniela Cristina Espinola%'
  and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') like 'dominadas%'
  -- lo que cubre el paso 7 (rutina activa, 15–30 kg), antes o después de correrlo
  and not (r.is_active and not r.is_template and s.weight_kg between 15 and 30)
  and s.id not in (select set_log_id from backup.set_logs_tracking_20261028 where step = '7')
order by fecha, serie;


-- =====================================================================
-- Deshacer (solo si hace falta). Cambiar el número de paso ('1', '2', '4', '7').
-- =====================================================================
-- update public.workout_set_logs s
-- set weight_kg = b.weight_kg, reps_completed = b.reps_completed, rir_actual = b.rir_actual,
--     duration_seconds = b.duration_seconds, intensity = b.intensity, assistance = b.assistance
-- from backup.set_logs_tracking_20261028 b
-- where b.step = '1' and s.id = b.set_log_id;
-- delete from backup.set_logs_tracking_20261028 where step = '1';
--
-- Paso 6 (rutina de Daniela; deshacer el 7 antes):
-- update public.routine_exercises re
-- set exercise_id = b.exercise_id
-- from backup.routine_exercises_tracking_20261028 b
-- where re.id = b.routine_exercise_id;
-- delete from backup.routine_exercises_tracking_20261028;
--
-- Paso 3 (catálogo):
-- update public.exercises e
-- set tracking_type = b.tracking_type, per_side = b.per_side
-- from backup.exercises_tracking_20261028 b
-- where e.id = b.exercise_id;
-- delete from backup.exercises_tracking_20261028;
