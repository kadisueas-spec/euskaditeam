-- Reportes de progreso tipo Wrapped (oct-2026) — ver docs/plan-reportes.md.
--
-- Flujo: el cron genera BORRADORES (sábado: semanal lunes a viernes; día 1:
-- mensual del mes anterior). El coach los revisa en /coach/reports y decide:
-- enviar ahora, programar para el domingo a su hora, o descartar. Nada le
-- llega al cliente sin esa decisión.
--
-- Dos tablas a propósito:
-- - progress_reports: lo que ve el cliente (tarjetas + nota del coach).
--   El cliente solo lee filas con status = 'sent'.
-- - progress_report_private: avisos "Solo lo ves vos" (volumen que bajó,
--   datos faltantes, rutina vencida...). Si estuvieran en la misma fila, el
--   cliente podría leerlos con una consulta directa a la Data API aunque la
--   app no los muestre: RLS filtra filas, no columnas.

create table if not exists public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sent', 'discarded')),
  -- Tarjetas que ve el cliente, en orden. Cada una lleva su phrase_key
  -- (situación + variante, ej. "weight.down.3") si usa una frase del banco.
  cards jsonb not null default '[]'::jsonb,
  -- Copia plana de las phrase_key de cards, para el "no repetir en 28 días"
  -- (se consulta sobre los reportes ENVIADOS del cliente).
  phrase_keys text[] not null default '{}',
  -- Nota personal del coach: se agrega como última tarjeta al enviar.
  coach_note text,
  generated_at timestamptz not null default now(),
  scheduled_for timestamptz,
  sent_at timestamptz,
  -- Seguimiento del cliente: abrió el reporte / llegó a la última tarjeta.
  -- Se escriben con service role tras verificar que el reporte es suyo
  -- (el cliente no tiene UPDATE, igual que welcome_banner_shown_at).
  opened_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (client_id, kind, period_start),
  constraint progress_reports_period check (period_end >= period_start),
  constraint progress_reports_scheduled_has_time
    check (status <> 'scheduled' or scheduled_for is not null),
  constraint progress_reports_sent_has_time
    check (status <> 'sent' or sent_at is not null)
);

create index if not exists progress_reports_coach_status_idx
  on public.progress_reports (coach_id, status);
create index if not exists progress_reports_client_sent_idx
  on public.progress_reports (client_id, sent_at desc) where status = 'sent';
create index if not exists progress_reports_due_idx
  on public.progress_reports (scheduled_for) where status = 'scheduled';

create table if not exists public.progress_report_private (
  report_id uuid primary key references public.progress_reports(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  -- Avisos de la tarjeta "Solo lo ves vos", ej.
  -- ["Volumen −25 % vs agosto: 12 entrenamientos contra 17", "Grasa: sin medición este mes"]
  notices jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Desde el 30-oct-2026 las tablas nuevas de public no reciben permisos de la
-- Data API solos: los GRANT van en la misma migración. Sin anon.
grant select, insert, update, delete on public.progress_reports to authenticated;
grant select, insert, update, delete on public.progress_reports to service_role;
grant select, insert, update, delete on public.progress_report_private to authenticated;
grant select, insert, update, delete on public.progress_report_private to service_role;

alter table public.progress_reports enable row level security;
alter table public.progress_report_private enable row level security;

create policy "Coach manages own clients reports" on public.progress_reports
  for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and client_id in (select id from public.clients where coach_id = auth.uid())
  );

-- El cliente ve solo los ENVIADOS, nunca borradores, programados ni descartados.
create policy "Client views own sent reports" on public.progress_reports
  for select
  using (
    status = 'sent'
    and client_id in (select id from public.clients where user_id = auth.uid())
  );

-- Solo el coach. El cliente no tiene ninguna policy acá.
create policy "Coach manages own report notices" on public.progress_report_private
  for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and report_id in (select id from public.progress_reports where coach_id = auth.uid())
  );

-- Hora del domingo a la que el coach programa los envíos (hora de Paraguay).
alter table public.profiles
  add column if not exists report_sunday_hour smallint not null default 10
  check (report_sunday_hour between 0 and 23);

notify pgrst, 'reload schema';
