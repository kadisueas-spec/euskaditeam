-- Plancha abdominal (oct-2026): ejercicio propio del coach, isométrico
-- (segundos), grupo Abdomen/Core, sin "por lado". Sin GIF ni video: es un
-- ejercicio distinto de la plancha frontal, no se copia el suyo.
--
-- Para correr si 20261028_tracking_types.sql ya se corrió (necesita la
-- columna tracking_type). Esa migración ya la incluye, así que si todavía
-- no la corriste, este archivo no hace falta. Saltea si ya existe una
-- "Plancha abdominal" (propia o global): en ese caso solo se asegura de
-- que sea de tipo time. Solo INSERT/UPDATE de filas: sin GRANT.
-- Correr a mano en el SQL Editor del Dashboard de Supabase.
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

  insert into public.exercises
    (coach_id, name, muscle_group, equipment, is_active, tracking_type, per_side)
  select v_coach_id, 'Plancha abdominal', 'Abdomen/Core', 'Peso corporal', true, 'time', false
  where not exists (
    select 1 from public.exercises e
    where (e.coach_id = v_coach_id or e.coach_id is null)
      and translate(lower(trim(e.name)), 'áéíóúü', 'aeiouu') = 'plancha abdominal'
  );

  update public.exercises
  set tracking_type = 'time', per_side = false
  where translate(lower(trim(name)), 'áéíóúü', 'aeiouu') = 'plancha abdominal';
end $$;

-- Control
select name, muscle_group, equipment, tracking_type, per_side, video_url, gif_url,
       case when coach_id is null then 'global' else 'propio' end as origen
from public.exercises
where translate(lower(trim(name)), 'áéíóúü', 'aeiouu') in ('plancha abdominal', 'plancha frontal')
order by name;
