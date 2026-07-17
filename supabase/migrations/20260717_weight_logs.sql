-- Registro de peso corporal diario del cliente (jul-2026). Complementa las
-- evaluaciones antropométricas formales (menos frecuentes, con protocolo y
-- pliegues) con un pesaje rápido que el cliente puede cargar cualquier día,
-- sin pasar por el coach.
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase (este proyecto
-- no tiene conexión directa a Postgres desde el entorno de desarrollo).

create table public.weight_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric(5,2) not null check (weight_kg > 0 and weight_kg <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un solo registro por cliente por día — si ya se pesó hoy, la UI edita
  -- la fila existente en vez de crear una segunda.
  unique (client_id, date)
);

create index idx_weight_logs_client_id on public.weight_logs (client_id);

-- Reusa la función que ya existe en la base (ver schema.sql,
-- public.update_updated_at) — mismo trigger que ya tienen
-- clients/exercises/profiles/routines.
create trigger update_weight_logs_updated_at
  before update on public.weight_logs
  for each row execute function public.update_updated_at();

alter table public.weight_logs enable row level security;

-- Cliente: gestiona (select/insert/update/delete) SUS propios registros.
create policy "Client manages own weight logs"
  on public.weight_logs
  using (client_id in (select clients.id from public.clients where clients.user_id = auth.uid()))
  with check (client_id in (select clients.id from public.clients where clients.user_id = auth.uid()));

-- Coach: solo LECTURA de los registros de sus clientes — el peso diario es
-- dato del cliente, el coach lo consulta pero no lo edita ni lo borra.
create policy "Coach views weight logs of own clients"
  on public.weight_logs for select
  using (client_id in (select clients.id from public.clients where clients.coach_id = auth.uid()));
