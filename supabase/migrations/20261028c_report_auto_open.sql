-- Reportes que se abren solos en Inicio (oct-2026): cuántas veces se abrió
-- solo un reporte enviado y cuándo fue la última, para no mostrarlo más de
-- 1 vez por día ni más de 3 veces por reporte. En el servidor (no en
-- localStorage) para que valga en todos los dispositivos del cliente.
--
-- Solo agrega columnas a una tabla existente: no lleva GRANT y el RLS no
-- cambia. El cliente sigue sin UPDATE sobre progress_reports: la marca la
-- escribe el servidor (service role) después de verificar con la sesión del
-- cliente que el reporte es suyo (markReportAutoOpened).
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase.

alter table public.progress_reports
  add column if not exists auto_open_count   integer not null default 0,
  add column if not exists auto_open_last_at timestamptz;

alter table public.progress_reports drop constraint if exists progress_reports_auto_open_count_check;
alter table public.progress_reports
  add constraint progress_reports_auto_open_count_check check (auto_open_count >= 0);

-- Control
select count(*) as reportes, count(*) filter (where status = 'sent' and opened_at is null) as enviados_sin_abrir
from public.progress_reports;
