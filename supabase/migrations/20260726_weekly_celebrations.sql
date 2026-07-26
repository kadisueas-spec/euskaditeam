-- Celebración semanal (jul-2026). Correr a mano en el SQL Editor del
-- Dashboard de Supabase — este archivo documenta el SQL real ejecutado.
--
-- Tabla dedicada en vez de un campo en workout_logs: la marca de "semana
-- celebrada" es un concepto por CLIENTE+SEMANA, no por sesión — una tabla
-- propia con unique(client_id, week_start) evita ambigüedad sobre en cuál
-- de los N workout_logs de la semana viviría el flag, y hace trivial el
-- chequeo "¿ya se celebró esta semana?" con un solo insert que falla si
-- ya existe (sin necesidad de un select previo).

create table public.weekly_celebrations (
  id uuid primary key default extensions.uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (client_id, week_start)
);

alter table public.weekly_celebrations enable row level security;

-- Mismo patrón que "Client manages own monthly goals".
create policy "Client manages own weekly celebrations" on public.weekly_celebrations
  using (client_id in (select id from public.clients where user_id = auth.uid()))
  with check (client_id in (select id from public.clients where user_id = auth.uid()));
