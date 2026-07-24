-- Sistema de mesociclos (jul-2026). Ya corrida a mano en el SQL Editor del
-- Dashboard de Supabase — este archivo documenta el SQL real ejecutado.
--
-- Reusa is_active/starts_at/ends_at (ya existían para los recordatorios de
-- "mesociclo por terminar") en vez de agregar archivada/fecha_inicio/
-- fecha_fin como columnas nuevas y redundantes.

-- 1. Columna nueva.
alter table public.routines
  add column mesociclo_nombre text;

-- 2. Backfill de las rutinas existentes.
update public.routines
  set mesociclo_nombre = 'Mesociclo inicial'
  where mesociclo_nombre is null;

-- 3. Si un cliente tiene más de una rutina activa (bug del sistema
-- anterior, createRoutine nunca desactivaba la rutina previa + datos de
-- prueba), dejar solo la más reciente activa y archivar el resto con la
-- fecha de hoy.
with duplicadas as (
  select
    id,
    row_number() over (
      partition by client_id
      order by starts_at desc nulls last, created_at desc
    ) as rn
  from public.routines
  where is_active = true
    and client_id is not null
)
update public.routines r
  set is_active = false,
      ends_at = current_date
  from duplicadas d
  where r.id = d.id
    and d.rn > 1;

-- 4. Constraint que impide que esto vuelva a pasar: como mucho una rutina
-- activa por cliente, a nivel de base — createRoutine ahora archiva la
-- rutina activa del cliente antes de insertar la nueva para no violarlo.
create unique index routines_one_active_per_client
  on public.routines (client_id)
  where is_active = true;
