-- FitCoach — Fase 1
-- Correr en el SQL editor de Supabase (Project > SQL Editor).

create table if not exists public.invite_codes (
  code text primary key,
  role text not null default 'client' check (role in ('client', 'coach')),
  created_by uuid references auth.users(id),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

-- Solo coaches autenticados pueden ver/crear códigos (para generarlos desde la app).
create policy "coaches manage invite codes"
  on public.invite_codes
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'coach')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'coach');

-- Valida un código sin exponer la tabla a usuarios anónimos.
create or replace function public.validate_invite_code(code_input text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role
  from invite_codes
  where code = code_input and used_by is null;

  return v_role; -- null si no existe o ya fue usado
end;
$$;

-- Marca el código como usado de forma atómica (evita doble uso por carrera).
create or replace function public.claim_invite_code(code_input text, user_id_input uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update invite_codes
  set used_by = user_id_input, used_at = now()
  where code = code_input and used_by is null;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

grant execute on function public.validate_invite_code(text) to anon, authenticated;
grant execute on function public.claim_invite_code(text, uuid) to anon, authenticated;

-- Ejemplo para generar un código manualmente desde el SQL editor:
-- insert into public.invite_codes (code, role) values ('CLIENTE-0001', 'client');
