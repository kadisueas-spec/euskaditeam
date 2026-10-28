-- Tipos de registro por ejercicio (oct-2026). Plan aprobado: peso + reps
-- (el de siempre), peso corporal, isométrico (segundos), cardio (minutos)
-- y "check" (solo hecho). Más la marca "por lado" y los asistidos.
--
-- Solo agrega columnas a tablas existentes: no lleva GRANT y el RLS no
-- cambia (las policies son por fila, cubren las columnas nuevas solas).
-- Se puede correr más de una vez (if not exists / drop constraint if
-- exists / el insert saltea lo que ya existe).
--
-- NO convierte datos viejos de series ni de rutinas: eso va aparte, después
-- de revisar los diagnósticos (docs/sql/tracking-types-diagnostico.sql).
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase.

-- ---------------------------------------------------------------------
-- 1) Catálogo: tipo de registro, por lado, asistencia y escala de cardio
-- ---------------------------------------------------------------------
alter table public.exercises
  add column if not exists tracking_type   text    not null default 'weight_reps',
  add column if not exists per_side        boolean not null default false,
  add column if not exists assistance_unit text,   -- 'kg' | 'band' (solo asistidos)
  add column if not exists cardio_scale    text;   -- 'level' | 'effort' (solo cardio)

alter table public.exercises drop constraint if exists exercises_tracking_type_check;
alter table public.exercises drop constraint if exists exercises_assistance_check;
alter table public.exercises drop constraint if exists exercises_cardio_scale_check;
alter table public.exercises
  add constraint exercises_tracking_type_check
    check (tracking_type in ('weight_reps', 'bodyweight_reps', 'time', 'cardio', 'check')),
  -- Asistido = peso corporal con ayuda (kg de la máquina o nivel de banda;
  -- en los dos, un número más alto es más ayuda: menos es mejor).
  add constraint exercises_assistance_check
    check (assistance_unit is null
           or (assistance_unit in ('kg', 'band') and tracking_type = 'bodyweight_reps')),
  add constraint exercises_cardio_scale_check
    check (cardio_scale is null
           or (cardio_scale in ('level', 'effort') and tracking_type = 'cardio'));

-- ---------------------------------------------------------------------
-- 2) Prescripción en la rutina (reps_min/reps_max/rir_target/rest_seconds
--    siguen igual para peso + reps y peso corporal)
-- ---------------------------------------------------------------------
alter table public.routine_exercises
  add column if not exists seconds_min      integer,       -- isométrico: "30–45 s"
  add column if not exists seconds_max      integer,
  add column if not exists minutes_target   integer,       -- cardio: "20 min"
  add column if not exists intensity_target numeric(4,1);  -- cardio: nivel o esfuerzo

alter table public.routine_exercises drop constraint if exists routine_exercises_tracking_targets_check;
alter table public.routine_exercises
  add constraint routine_exercises_tracking_targets_check
    check ((seconds_min is null or seconds_min > 0)
       and (seconds_max is null or seconds_max > 0)
       and (minutes_target is null or minutes_target > 0)
       and (intensity_target is null or intensity_target >= 0));

-- ---------------------------------------------------------------------
-- 3) Series: lo nuevo que se anota. weight_kg = kilos (o kilos EXTRA en
--    peso corporal e isométricos); reps_completed y rir_actual se reusan.
--    Un "check" es una fila sin valores: que exista = hecho.
-- ---------------------------------------------------------------------
alter table public.workout_set_logs
  add column if not exists duration_seconds integer,      -- isométrico y cardio (cardio: minutos × 60)
  add column if not exists distance_km      numeric(6,2),
  add column if not exists intensity        numeric(4,1), -- nivel de máquina o esfuerzo 1-10
  add column if not exists assistance       numeric(6,2); -- kg de ayuda o nivel de banda

alter table public.workout_set_logs drop constraint if exists workout_set_logs_tracking_values_check;
alter table public.workout_set_logs
  add constraint workout_set_logs_tracking_values_check
    check ((duration_seconds is null or duration_seconds > 0)
       and (distance_km is null or distance_km >= 0)
       and (intensity is null or intensity >= 0)
       and (assistance is null or assistance >= 0));

-- ---------------------------------------------------------------------
-- 4) Ejercicio nuevo: Dominadas asistidas (propio del coach, como los de
--    abdomen y cardio — así se puede editar desde la app). Saltea si ya
--    existe con ese nombre.
-- ---------------------------------------------------------------------
do $$
declare
  v_coach_id    uuid;
  v_coach_count int;
begin
  select count(*), min(id::text)::uuid into v_coach_count, v_coach_id
  from public.profiles where role = 'coach';
  if v_coach_count <> 1 then
    raise exception 'Se esperaba exactamente 1 coach y hay %', v_coach_count;
  end if;

  insert into public.exercises (coach_id, name, muscle_group, equipment, is_active)
  select v_coach_id, 'Dominadas asistidas', 'Espalda', 'Máquina asistida', true
  where not exists (
    select 1 from public.exercises e
    where (e.coach_id = v_coach_id or e.coach_id is null)
      and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') = 'dominadas asistidas'
  );

  -- Plancha abdominal: ejercicio distinto de la plancha frontal, sin GIF ni
  -- video (no se copia el de la frontal).
  insert into public.exercises (coach_id, name, muscle_group, equipment, is_active)
  select v_coach_id, 'Plancha abdominal', 'Abdomen/Core', 'Peso corporal', true
  where not exists (
    select 1 from public.exercises e
    where (e.coach_id = v_coach_id or e.coach_id is null)
      and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') = 'plancha abdominal'
  );
end $$;

-- ---------------------------------------------------------------------
-- 5) Clasificación de los ejercicios existentes (lista aprobada). Lo que
--    no está acá queda como 'weight_reps' sin "por lado", igual que hoy.
--    Compara sin mayúsculas ni tildes; actualiza propios y globales.
-- ---------------------------------------------------------------------
drop table if exists pg_temp.tracking_classification;
create temp table tracking_classification (
  name text, tracking_type text, per_side boolean, cardio_scale text, assistance_unit text
);

insert into tracking_classification values
  -- Peso corporal (kilos extra opcionales, RIR opcional)
  ('Crunch abdominal',                                  'bodyweight_reps', false, null, null),
  ('Crunch en el suelo',                                'bodyweight_reps', false, null, null),
  ('Crunch inverso',                                    'bodyweight_reps', false, null, null),
  ('Sit-up',                                            'bodyweight_reps', false, null, null),
  ('Elevación de piernas colgado',                      'bodyweight_reps', false, null, null),
  ('Elevación de piernas en paralelas',                 'bodyweight_reps', false, null, null),
  ('Elevación de piernas tumbado',                      'bodyweight_reps', false, null, null),
  ('Rueda abdominal (ab wheel rollout)',                'bodyweight_reps', false, null, null),
  ('Ab rollout en barra',                               'bodyweight_reps', false, null, null),
  ('Tijeras',                                           'bodyweight_reps', false, null, null),
  ('Toque de talones',                                  'bodyweight_reps', false, null, null),
  ('Bicicleta abdominal',                               'bodyweight_reps', false, null, null),
  ('Giro ruso (Russian twist)',                         'bodyweight_reps', false, null, null),
  ('Dragon flag',                                       'bodyweight_reps', false, null, null),
  ('Dominadas (pull-ups)',                              'bodyweight_reps', false, null, null),
  ('Remo invertido (Australian pull-up)',               'bodyweight_reps', false, null, null),
  ('Flexiones de brazos (push-ups)',                    'bodyweight_reps', false, null, null),
  ('Fondos en paralelas (para pecho)',                  'bodyweight_reps', false, null, null),
  ('Fondos en paralelas (para tríceps)',                'bodyweight_reps', false, null, null),
  ('Fondos en banco (dips en banco)',                   'bodyweight_reps', false, null, null),
  ('Elevación de talones en escalón con peso corporal', 'bodyweight_reps', false, null, null),
  ('Patada de glúteo en cuadrupedia',                   'bodyweight_reps', true,  null, null),
  ('Burpees',                                           'bodyweight_reps', false, null, null),
  -- Asistido (peso corporal con ayuda en kg)
  ('Dominadas asistidas',                               'bodyweight_reps', false, null, 'kg'),
  -- Isométricos (segundos, kilos extra opcionales)
  ('Plancha frontal',                                   'time',            false, null, null),
  ('Plancha abdominal',                                 'time',            false, null, null),
  ('Plancha lateral',                                   'time',            true,  null, null),
  ('Hollow body hold',                                  'time',            false, null, null),
  ('Mountain climbers',                                 'time',            false, null, null),
  -- Cardio (minutos; distancia e intensidad opcionales)
  ('Caminata en cinta',                                 'cardio',          false, 'level',  null),
  ('Trote en cinta',                                    'cardio',          false, 'level',  null),
  ('Bicicleta estática',                                'cardio',          false, 'level',  null),
  ('Bicicleta elíptica',                                'cardio',          false, 'level',  null),
  ('Remo ergométrico',                                  'cardio',          false, 'level',  null),
  ('Escaladora',                                        'cardio',          false, 'level',  null),
  ('Salto a la soga',                                   'cardio',          false, 'effort', null),
  ('Step',                                              'cardio',          false, 'effort', null),
  ('Sprints',                                           'cardio',          false, 'effort', null),
  -- Con peso, por lado (el curl alterno NO: se cuenta el total)
  ('Sentadilla búlgara',                                'weight_reps',     true,  null, null),
  ('Zancadas con mancuernas',                           'weight_reps',     true,  null, null),
  ('Step up con mancuernas',                            'weight_reps',     true,  null, null),
  ('Remo con mancuerna a un brazo',                     'weight_reps',     true,  null, null),
  ('Jalón unilateral con banco',                        'weight_reps',     true,  null, null),
  ('Curl concentrado',                                  'weight_reps',     true,  null, null),
  ('Patada de tríceps con mancuerna',                   'weight_reps',     true,  null, null),
  ('Elevaciones laterales en polea',                    'weight_reps',     true,  null, null),
  ('Elevación de talones a una pierna con mancuerna',   'weight_reps',     true,  null, null),
  ('Hip thrust a una pierna',                           'weight_reps',     true,  null, null),
  ('Peso muerto a una pierna con mancuerna',            'weight_reps',     true,  null, null),
  ('Patada de glúteo en polea',                         'weight_reps',     true,  null, null),
  ('Patada diagonal en polea',                          'weight_reps',     true,  null, null);

update public.exercises e
set tracking_type   = c.tracking_type,
    per_side        = c.per_side,
    cardio_scale    = c.cardio_scale,
    assistance_unit = c.assistance_unit
from tracking_classification c
where translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu')
    = translate(lower(trim(c.name)), 'áéíóúü', 'aeiouu');

-- ---------------------------------------------------------------------
-- 6) Control. El SQL Editor muestra solo el resultado de la última
--    consulta, por eso va todo junto: primero los nombres de la lista que
--    NO están en el catálogo (no se clasificó nada con ese nombre),
--    después todo lo que quedó distinto del default (puede haber
--    duplicados propio/global con el mismo nombre).
-- ---------------------------------------------------------------------
select estado, name, tracking_type, per_side, cardio_scale, assistance_unit, origen
from (
  select 1 as orden, 'NO ENCONTRADO' as estado, c.name, c.tracking_type, c.per_side,
         c.cardio_scale, c.assistance_unit, null::text as origen
  from tracking_classification c
  where not exists (
    select 1 from public.exercises e
    where translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu')
        = translate(lower(trim(c.name)), 'áéíóúü', 'aeiouu')
  )
  union all
  select 2, 'clasificado', e.name, e.tracking_type, e.per_side, e.cardio_scale, e.assistance_unit,
         case when e.coach_id is null then 'global' else 'propio' end
  from public.exercises e
  where e.tracking_type <> 'weight_reps' or e.per_side
) t
order by orden, tracking_type, name;
