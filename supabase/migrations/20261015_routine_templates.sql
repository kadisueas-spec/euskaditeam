-- Plantillas de rutinas (oct-2026): una plantilla es una rutina más, marcada
-- con is_template, sin cliente, sin fechas y nunca activa. Reusa
-- routine_days/routine_exercises y el RLS existente ("Coach manages
-- routines" ya filtra por coach_id; las policies del cliente filtran por
-- client_id, que en una plantilla es NULL). Hace falta la columna aparte
-- porque client_id NULL ya lo usan las rutinas de Mi Entrenamiento del coach.
alter table public.routines
  add column if not exists is_template boolean not null default false;

-- Candado a nivel base: una plantilla no puede tener cliente, fechas ni
-- estar activa. Al no estar nunca activa, queda afuera sola de:
--   · los avisos de "mesociclo por terminar" de daily-checks
--     (is_active = true y ends_at no nulo), sin redeployar la Edge Function
--   · Mi Entrenamiento del coach (client_id null + is_active = true)
--   · el índice único routines_one_active_per_client
alter table public.routines
  add constraint routines_template_shape check (
    not is_template
    or (client_id is null and is_active = false
        and starts_at is null and ends_at is null)
  );

create index if not exists routines_coach_templates_idx
  on public.routines (coach_id, name)
  where is_template;

-- Verificación: tiene que devolver 0 plantillas
-- (todas las rutinas actuales quedan con is_template = false)
select count(*) filter (where is_template) as plantillas,
       count(*) as total
from public.routines;
