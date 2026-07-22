-- Sistema de renovaciones y retención de clientes (jul-2026).
-- Correr a mano en el SQL Editor del Dashboard de Supabase (este proyecto
-- no tiene conexión directa a Postgres desde el entorno de desarrollo).
--
-- Registro histórico de clientes eliminados por inactividad (5+ días sin
-- renovar, ver daily-checks Edge Function) — solo para consulta del coach,
-- no tiene relación funcional con el resto del schema (el cliente ya no
-- existe cuando se lee esta tabla).

create table public.deleted_clients_log (
  id uuid primary key default extensions.uuid_generate_v4(),
  client_id uuid not null,
  coach_id uuid references public.profiles(id) on delete set null,
  full_name text,
  email text,
  subscription_end_date timestamptz,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_clients_log enable row level security;

-- Solo lectura para el coach de sus propios clientes eliminados. Los
-- inserts los hace exclusivamente el service role desde la Edge Function
-- (RLS no tiene policy de INSERT, así que queda bloqueado para todo lo
-- demás).
create policy "Coach ve su propio log de clientes eliminados"
  on public.deleted_clients_log for select
  using (coach_id = auth.uid());
