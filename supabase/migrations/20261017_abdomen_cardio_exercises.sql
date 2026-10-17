-- Ejercicios de abdomen y cardio (oct-2026), con video de YouTube.
-- video_url guarda solo el ID del video (mismo formato que
-- app/coach/exercises/actions.ts). Grupos: "Abdomen/Core" y "Cardio", los
-- que ya existen en lib/constants/exercises.ts (no se crea un grupo
-- "Cardio/Aeróbico" aparte: partiría el filtro de la biblioteca en dos).
--
-- Se cargan como ejercicios PROPIOS del coach (coach_id = su id), no
-- globales: un ejercicio global (coach_id NULL) queda de solo lectura en la
-- app, y así el coach puede cambiar el video desde /coach/exercises si
-- alguno no le convence.
--
-- No duplica: saltea cualquier nombre que ya exista (propio o global),
-- comparando sin mayúsculas ni tildes. Se puede correr más de una vez.
-- Correr a mano en el SQL Editor del Dashboard de Supabase.
do $$
declare
  v_coach_id    uuid;
  v_coach_count int;
  v_inserted    int;
begin
  select count(*), min(id::text)::uuid into v_coach_count, v_coach_id
  from public.profiles where role = 'coach';

  if v_coach_count <> 1 then
    raise exception 'Se esperaba exactamente 1 coach y hay %', v_coach_count;
  end if;

  with nuevos(name, muscle_group, equipment, video_url) as (
    values
      -- Abdomen
      ('Crunch en el suelo',               'Abdomen/Core', 'Peso corporal',   'hl9Yu7UZqHU'),
      ('Crunch en polea alta',             'Abdomen/Core', 'Polea',           'nKdVI-LXKzs'),
      ('Crunch inverso',                   'Abdomen/Core', 'Peso corporal',   'n5zmEJmTixg'),
      ('Elevación de piernas colgado',     'Abdomen/Core', 'Barra fija',      'yJW8Gsovjfo'),
      ('Elevación de piernas en paralelas','Abdomen/Core', 'Paralelas',       'u2-nJioRs6o'),
      ('Plancha frontal',                  'Abdomen/Core', 'Peso corporal',   'nmX0DysvqcQ'),
      ('Plancha lateral',                  'Abdomen/Core', 'Peso corporal',   'kyOeSuh7LLo'),
      ('Rueda abdominal (ab wheel rollout)','Abdomen/Core','Rueda abdominal', 'b01FmYynI2o'),
      ('Sit-up',                           'Abdomen/Core', 'Peso corporal',   'oUpADVmt9W8'),
      ('Tijeras',                          'Abdomen/Core', 'Peso corporal',   'UDqDYCWMCLo'),
      ('Bicicleta abdominal',              'Abdomen/Core', 'Peso corporal',   'ibGRT6byKHI'),
      ('Toque de talones',                 'Abdomen/Core', 'Peso corporal',   'PmD8OjgsdrY'),
      ('Hollow body hold',                 'Abdomen/Core', 'Peso corporal',   'Pu1OJjgtpco'),
      ('Dragon flag',                      'Abdomen/Core', 'Banco',           'NI8kcpf_koo'),
      ('Ab rollout en barra',              'Abdomen/Core', 'Barra',           'usOcxCpSTiE'),
      -- Cardio
      ('Caminata en cinta',                'Cardio',       'Cinta',           '9ccVxEvWtpA'),
      ('Trote en cinta',                   'Cardio',       'Cinta',           'clOMvIG1R-o'),
      ('Bicicleta estática',               'Cardio',       'Bicicleta fija',  'zaUWNvgelAU'),
      ('Bicicleta elíptica',               'Cardio',       'Elíptica',        'Sbv44Rf-5U0'),
      ('Remo ergométrico',                 'Cardio',       'Remoergómetro',   'ln9-nno3mMU'),
      ('Salto a la soga',                  'Cardio',       'Soga',            'AnQwqHgZdoQ'),
      ('Step',                             'Cardio',       'Cajón/step',      'jY7t0IYJo5I'),
      ('Burpees',                          'Cardio',       'Peso corporal',   'Uy2nUNX38xE'),
      ('Mountain climbers',                'Cardio',       'Peso corporal',   'XWlDAy4_Dvw'),
      ('Sprints',                          'Cardio',       'Peso corporal',   'mFARDWKsHIA'),
      ('Escaladora',                       'Cardio',       'Escaladora',      'h7OQg-rKQU8')
  ),
  insertados as (
    insert into public.exercises (coach_id, name, muscle_group, equipment, video_url, is_active)
    select v_coach_id, n.name, n.muscle_group, n.equipment, n.video_url, true
    from nuevos n
    where not exists (
      select 1 from public.exercises e
      where (e.coach_id = v_coach_id or e.coach_id is null)
        and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu')
          = translate(lower(trim(n.name)), 'áéíóúü', 'aeiouu')
    )
    returning 1
  )
  select count(*) into v_inserted from insertados;

  raise notice 'Ejercicios nuevos insertados: % (de 26; el resto ya existía)', v_inserted;
end $$;

-- Verificación: los 26 tienen que aparecer, con su video.
select name, muscle_group, video_url,
       case when coach_id is null then 'global' else 'propio' end as tipo
from public.exercises
where translate(lower(trim(name)), 'áéíóúü', 'aeiouu') in (
  'crunch en el suelo', 'crunch en polea alta', 'crunch inverso',
  'elevacion de piernas colgado', 'elevacion de piernas en paralelas',
  'plancha frontal', 'plancha lateral', 'rueda abdominal (ab wheel rollout)',
  'sit-up', 'tijeras', 'bicicleta abdominal', 'toque de talones',
  'hollow body hold', 'dragon flag', 'ab rollout en barra',
  'caminata en cinta', 'trote en cinta', 'bicicleta estatica',
  'bicicleta eliptica', 'remo ergometrico', 'salto a la soga', 'step',
  'burpees', 'mountain climbers', 'sprints', 'escaladora'
)
order by muscle_group, name;
