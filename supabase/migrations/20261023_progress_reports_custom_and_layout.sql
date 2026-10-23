-- Reportes de progreso: período libre y tarjetas elegidas por el coach
-- (oct-2026). Sobre 20261022_progress_reports.sql.
--
-- 1) kind 'custom': rango de fechas libre elegido por el coach ("3 al 17 de
--    noviembre"). Semanal (lunes a viernes) y mensual (mes calendario)
--    siguen igual.
-- 2) La unicidad pasa a incluir period_end: dos rangos libres pueden
--    arrancar el mismo día con distinto fin.
-- 3) card_layout: qué tarjetas prendió/apagó el coach y en qué orden
--    ({ "order": [...], "enabled": { "<clave>": true|false } }). Se guarda
--    aparte de cards para que sobreviva a "Volver a generar".
--
-- Sin tablas nuevas: los GRANT de progress_reports ya existen.

-- Nombres generados por Postgres en la migración anterior. Si alguno no
-- coincide, verlos con:
--   select conname from pg_constraint where conrelid = 'public.progress_reports'::regclass;
alter table public.progress_reports
  drop constraint if exists progress_reports_kind_check;
alter table public.progress_reports
  add constraint progress_reports_kind_check
  check (kind in ('weekly', 'monthly', 'custom'));

alter table public.progress_reports
  drop constraint if exists progress_reports_client_id_kind_period_start_key;
alter table public.progress_reports
  add constraint progress_reports_client_kind_period_key
  unique (client_id, kind, period_start, period_end);

alter table public.progress_reports
  add column if not exists card_layout jsonb;

notify pgrst, 'reload schema';
